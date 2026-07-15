from typing import Optional

from fastapi import APIRouter, Body
from pydantic import BaseModel

from core.database import SessionLocal
from models.postgres_model import Campaign, Contact, Organization

router = APIRouter()

class OrganizationCreate(BaseModel):
    name: str
    email: Optional[str] = None
    industry: Optional[str] = None
    status: str = "Active"

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    industry: Optional[str] = None
    status: Optional[str] = None

@router.post("/create")
def create_organization(data: OrganizationCreate = Body(...)):
    db = SessionLocal()

    org = Organization(
        name=data.name,
        email=data.email,
        industry=data.industry,
        status=data.status,
    )

    db.add(org)
    db.commit()
    db.refresh(org)

    db.close()

    return {
        "success": True,
        "organization_id": org.id
    }

@router.get("")
def get_organizations(q: str = None, status: str = None, sort: str = "newest"):
    db = SessionLocal()

    query = db.query(Organization)

    if q:
        search = f"%{q.lower()}%"
        query = query.filter(
            Organization.name.ilike(search) |
            Organization.email.ilike(search) |
            Organization.industry.ilike(search)
        )

    if status and status.lower() != "all":
        query = query.filter(Organization.status == status)

    if sort == "oldest":
        query = query.order_by(Organization.created_at.asc())
    else:
        query = query.order_by(Organization.created_at.desc())

    organizations = query.all()

    result = []

    for org in organizations:
        contacts_count = db.query(Contact).filter(Contact.organization_id == org.id).count()
        campaigns_count = db.query(Campaign).filter(Campaign.organization_id == org.id).count()

        result.append({
            "id": org.id,
            "name": org.name,
            "email": org.email,
            "industry": org.industry,
            "status": org.status,
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "contacts_count": contacts_count,
            "campaigns_count": campaigns_count,
        })

    db.close()

    return result

@router.get("/{organization_id}")
def get_organization(organization_id: int):
    db = SessionLocal()

    org = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()

    if not org:
        db.close()
        return {
            "success": False,
            "message": "Organization not found"
        }

    contacts_count = db.query(Contact).filter(Contact.organization_id == org.id).count()
    campaigns_count = db.query(Campaign).filter(Campaign.organization_id == org.id).count()

    result = {
        "id": org.id,
        "name": org.name,
        "email": org.email,
        "industry": org.industry,
        "status": org.status,
        "created_at": org.created_at.isoformat() if org.created_at else None,
        "contacts_count": contacts_count,
        "campaigns_count": campaigns_count,
    }

    db.close()

    return result

@router.put("/{organization_id}")
def update_organization(
    organization_id: int,
    data: OrganizationUpdate = Body(...)
):
    db = SessionLocal()

    org = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()

    if not org:
        db.close()
        return {
            "success": False,
            "message": "Organization not found"
        }

    if data.name is not None:
        org.name = data.name
    if data.email is not None:
        org.email = data.email
    if data.industry is not None:
        org.industry = data.industry
    if data.status is not None:
        org.status = data.status

    db.commit()
    db.close()

    return {
        "success": True,
        "message": "Organization updated"
    }

@router.delete("/{organization_id}")
def delete_organization(
    organization_id: int
):
    db = SessionLocal()

    org = db.query(Organization).filter(
        Organization.id == organization_id
    ).first()

    if not org:
        db.close()
        return {
            "success": False,
            "message": "Organization not found"
        }

    db.delete(org)

    db.commit()
    db.close()

    return {
        "success": True,
        "message": "Organization deleted"
    }