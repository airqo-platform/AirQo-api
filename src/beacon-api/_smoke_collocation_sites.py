import asyncio
from app.db.session import SessionLocal
from app.services import collocation_service


async def main():
    db = SessionLocal()
    try:
        result = await collocation_service.get_collocation_sites(
            token="unused", db=db, params={"skip": 0, "limit": 5}
        )
        print("collocation sites fetch completed")
        sites = result.get("sites", [])
        print("site count:", len(sites))

        print("sample summary:", {
            "requested_skip": 0,
            "requested_limit": 5,
            "returned_site_count": len(sites),
        })
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
