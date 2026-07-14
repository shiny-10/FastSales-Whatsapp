from fastapi import APIRouter
from core.database import SessionLocal
from models.postgres_model import Campaign, Contact, Organization

router = APIRouter()

@router.post("/create")
def create_organization(data: dict):
    db = SessionLocal()

    org = Organization(
        name=data["name"],
        email=data.get("email"),
        industry=data.get("industry"),
        status=data.get("status", "Active"),
    )

    db.add(org)
    db.commit()
    db.refresh(org)

    db.close()

    return {
        "success": True,
        "organization_id": org.id
    }

@router.get("/")
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
    data: dict
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

    org.name = data.get("name", org.name)
    org.email = data.get("email", org.email)
    org.industry = data.get("industry", org.industry)
    org.status = data.get("status", org.status)

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