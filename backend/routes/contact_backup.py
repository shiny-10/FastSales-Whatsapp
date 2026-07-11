from fastapi import APIRouter
from database.db import SessionLocal
from models.postgres_model import Contact

router = APIRouter()


@router.post("/create")
def create_contact(data: dict):
    db = SessionLocal()

    contact = Contact(
    name=data["name"],
    phone_number=data["phone_number"],
    email=data.get("email"),
    tag=data.get("tag"),
    order_id=data.get("order_id")
)

    db.add(contact)
    db.commit()
    db.refresh(contact)

    db.close()

    return {
        "success": True,
        "contact_id": contact.id
    }


@router.get("/")
def get_contacts():
    db = SessionLocal()

    contacts = db.query(Contact).all()

    result = []

    for c in contacts:
        result.append({
            "id": c.id,
            "name": c.name,
            "phone_number": c.phone_number,
            "email": c.email,
            "tag": c.tag
        })

    db.close()

    return result

@router.get("/{contact_id}")
def get_contact(contact_id: int):
    db = SessionLocal()

    contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()

    if not contact:
        db.close()
        return {
            "success": False,
            "message": "Contact not found"
        }

    result = {
        "id": contact.id,
        "name": contact.name,
        "phone_number": contact.phone_number,
        "email": contact.email,
        "tag": contact.tag
    }

    db.close()

    return result


@router.put("/{contact_id}")
def update_contact(contact_id: int, data: dict):
    db = SessionLocal()

    contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()

    if not contact:
        db.close()
        return {
            "success": False,
            "message": "Contact not found"
        }

    contact.name = data["name"]
    contact.phone_number = data["phone_number"]
    contact.email = data.get("email")
    contact.tag = data.get("tag")

    db.commit()
    db.close()

    return {
        "success": True,
        "message": "Contact updated"
    }

@router.delete("/{contact_id}")
def delete_contact(contact_id: int):
    db = SessionLocal()

    contact = db.query(Contact).filter(
        Contact.id == contact_id
    ).first()

    if not contact:
        db.close()
        return {
            "success": False,
            "message": "Contact not found"
        }

    db.delete(contact)
    db.commit()
    db.close()

    return {
        "success": True,
        "message": "Contact deleted"
    }