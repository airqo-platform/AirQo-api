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

        sample_sites = sites[:3]
        sample_device_total = sum(len(s.get("devices_info", [])) for s in sample_sites)
        sample_categories = sorted(
            {
                d.get("category")
                for s in sample_sites
                for d in s.get("devices_info", [])
                if d.get("category") is not None
            }
        )
        print("sample summary:", {
            "sample_size": len(sample_sites),
            "sample_devices": sample_device_total,
            "sample_categories": sample_categories,
        })
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
