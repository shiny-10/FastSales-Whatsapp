from core.database import SessionLocal
from models.postgres_model import Contact, Organization
from fastapi import APIRouter, Query, UploadFile, File
import pandas as pd

router = APIRouter()

@router.post("/create")
def create_contact(data: dict):
    db = SessionLocal()

    contact = Contact(
        name=data["name"],
        phone_number=data["phone_number"],
        email=data.get("email"),
        tag=data.get("tag"),
        order_id=data.get("order_id"),
        organization_id=data.get("organization_id"),
        status=data.get("status", "Active"),
    )

    db.add(contact)
    db.commit()
    db.refresh(contact)

    db.close()

    return {
        "success": True,
        "contact_id": contact.id,
    }

@router.get("/")
def get_contacts(q: str = None, organization_id: int = None, status: str = None):
    db = SessionLocal()

    query = db.query(Contact)

    if q:
        search = f"%{q}%"
        query = query.filter(
            Contact.name.ilike(search)
            | Contact.phone_number.ilike(search)
            | Contact.email.ilike(search)
        )

    if organization_id:
        query = query.filter(Contact.organization_id == organization_id)

    if status and status.lower() != "all":
        query = query.filter(Contact.status == status)

    contacts = query.order_by(Contact.created_at.desc()).all()

    org_ids = {c.organization_id for c in contacts if c.organization_id}
    org_names = {}
    if org_ids:
        orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
        org_names = {org.id: org.name for org in orgs}

    result = []

    for c in contacts:
        result.append({
            "id": c.id,
            "name": c.name,
            "phone_number": c.phone_number,
            "email": c.email,
            "organization_id": c.organization_id,
            "organization_name": org_names.get(c.organization_id, "-"),
            "status": c.status,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    db.close()

    return result

@router.put("/{contact_id}")
def update_contact(contact_id: int, data: dict):
    db = SessionLocal()

    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    if not contact:
        db.close()
        return {"success": False, "message": "Contact not found"}

    contact.name = data.get("name", contact.name)
    contact.phone_number = data.get("phone_number", contact.phone_number)
    contact.email = data.get("email", contact.email)
    contact.tag = data.get("tag", contact.tag)
    contact.organization_id = data.get("organization_id", contact.organization_id)
    contact.status = data.get("status", contact.status)

    db.commit()
    db.close()

    return {
        "success": True,
        "message": "Contact updated",
    }

@router.delete("/{contact_id}")
def delete_contact(contact_id: int):
    db = SessionLocal()

    contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()

    if not contact:
        return {"success": False, "message": "Contact not found"}

    db.delete(contact)
    db.commit()
    db.close()

    return {
        "success": True,
        "message": "Contact deleted"
    }

@router.get("/search")
def search_contacts(name: str = Query(None)):
    db = SessionLocal()

    contacts = db.query(Contact).filter(
        Contact.name.ilike(f"%{name}%")
    ).all()

    result = []

    for c in contacts:
        result.append({
            "id": c.id,
            "name": c.name,
            "phone_number": c.phone_number,
            "email": c.email,
            "tag": c.tag,
            "order_id": c.order_id
        })

    db.close()

    return result

@router.post("/import")
def import_contacts(file: UploadFile = File(...)):
    db = SessionLocal()

    try:

        if file.filename.endswith(".csv"):
            df = pd.read_csv(file.file)

        elif file.filename.endswith(".xlsx"):
            df = pd.read_excel(file.file)

        else:
            return {
                "success": False,
                "message": "Only CSV and XLSX files are supported"
            }

        count = 0

        for _, row in df.iterrows():

            existing_contact = db.query(Contact).filter(
                Contact.phone_number == str(row["phone_number"])
            ).first()

            if existing_contact:
                continue

            contact = Contact(
                name=row["name"],
                phone_number=str(row["phone_number"]),
                email=row.get("email"),
                tag=row.get("tag"),
                order_id=row.get("order_id")
            )

            db.add(contact)
            count += 1

        db.commit()

        return {
            "success": True,
            "imported_contacts": count
        }

    except Exception as e:
        db.rollback()

        return {
            "success": False,
            "error": str(e)
        }

    finally:
        db.close()