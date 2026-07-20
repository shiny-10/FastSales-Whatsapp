from typing import Optional

from fastapi import APIRouter, Body, Query, UploadFile, File
from pydantic import BaseModel

from core.database import SessionLocal
from models.postgres_model import Contact, Organization
import pandas as pd

router = APIRouter()

class ContactCreate(BaseModel):
    name: str
    phone_number: str
    email: Optional[str] = None
    tag: Optional[str] = None
    order_id: Optional[str] = None
    organization_id: Optional[int] = None
    status: str = "Active"

class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    tag: Optional[str] = None
    organization_id: Optional[int] = None
    status: Optional[str] = None

@router.post("/create")
def create_contact(data: ContactCreate = Body(...)):
    db = SessionLocal()

    contact = Contact(
        name=data.name,
        phone_number=data.phone_number,
        email=data.email,
        tag=data.tag,
        order_id=data.order_id,
        organization_id=data.organization_id,
        status=data.status,
    )

    db.add(contact)
    db.commit()
    db.refresh(contact)

    db.close()

    return {
        "success": True,
        "contact_id": contact.id,
    }

@router.get("")
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
            "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
        })

    db.close()

    return result

@router.put("/{contact_id}")
def update_contact(contact_id: int, data: ContactUpdate = Body(...)):
    db = SessionLocal()

    contact = db.query(Contact).filter(Contact.id == contact_id).first()

    if not contact:
        db.close()
        return {"success": False, "message": "Contact not found"}

    if data.name is not None:
        contact.name = data.name
    if data.phone_number is not None:
        contact.phone_number = data.phone_number
    if data.email is not None:
        contact.email = data.email
    if data.tag is not None:
        contact.tag = data.tag
    if data.organization_id is not None:
        contact.organization_id = data.organization_id
    if data.status is not None:
        contact.status = data.status

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

        # ── Normalize column names ─────────────────────────────────────────
        # Strip whitespace and lowercase all column names so we handle:
        # "Phone Number", "phone_number", "Phone", "mobile", "PHONE" etc.
        df.columns = df.columns.str.strip().str.lower().str.replace(r"[\s\-]+", "_", regex=True)

        # Flexible column aliases → canonical name
        PHONE_ALIASES = {"phone_number", "phone", "mobile", "mobile_number", "contact", "number", "tel", "telephone"}
        NAME_ALIASES  = {"name", "full_name", "contact_name", "customer_name", "first_name"}
        EMAIL_ALIASES = {"email", "email_address", "mail"}

        def find_col(df_cols: list, aliases: set) -> str | None:
            for col in df_cols:
                if col in aliases:
                    return col
            return None

        cols = list(df.columns)
        phone_col = find_col(cols, PHONE_ALIASES)
        name_col  = find_col(cols, NAME_ALIASES)
        email_col = find_col(cols, EMAIL_ALIASES)
        tag_col   = find_col(cols, {"tag", "tags", "label"})
        order_col = find_col(cols, {"order_id", "order", "order_number"})

        if not phone_col:
            return {
                "success": False,
                "message": (
                    f"Could not find a phone number column. "
                    f"Your CSV has: {', '.join(cols)}. "
                    f"Please name the column: phone_number, phone, or mobile."
                )
            }

        if not name_col:
            return {
                "success": False,
                "message": (
                    f"Could not find a name column. "
                    f"Your CSV has: {', '.join(cols)}. "
                    f"Please name the column: name or full_name."
                )
            }

        count = 0
        skipped = 0

        for _, row in df.iterrows():
            phone_val = str(row[phone_col]).strip() if pd.notna(row[phone_col]) else ""
            name_val  = str(row[name_col]).strip()  if pd.notna(row[name_col])  else ""

            if not phone_val or phone_val.lower() in ("nan", "none", ""):
                skipped += 1
                continue

            # Skip duplicates
            existing = db.query(Contact).filter(
                Contact.phone_number == phone_val
            ).first()
            if existing:
                skipped += 1
                continue

            contact = Contact(
                name=name_val or phone_val,
                phone_number=phone_val,
                email=str(row[email_col]).strip() if email_col and pd.notna(row[email_col]) else None,
                tag=str(row[tag_col]).strip()     if tag_col   and pd.notna(row[tag_col])   else None,
                order_id=str(row[order_col]).strip() if order_col and pd.notna(row[order_col]) else None,
                status="Active",
            )

            db.add(contact)
            count += 1

        db.commit()

        return {
            "success": True,
            "message": f"Imported {count} contacts" + (f" ({skipped} skipped)" if skipped else ""),
            "imported_contacts": count,
            "skipped": skipped,
        }

    except Exception as e:
        db.rollback()
        return {
            "success": False,
            "error": str(e)
        }

    finally:
        db.close()
