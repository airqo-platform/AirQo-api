import asyncio
from app.db.session import SessionLocal
from app.services import collocation_service


async def main():
    db = SessionLocal()
    try:
        result = await collocation_service.get_collocation_sites(
            token="unused", db=db, params={"skip": 0, "limit": 5}
        )
        print("success:", result.get("success"))
        print("meta:", result.get("meta"))
        sites = result.get("sites", [])
        print("site count:", len(sites))
        for s in sites[:3]:
            devs = s.get("devices_info", [])
            cats = sorted({d.get("category") for d in devs})
            print(
                f"  {s['_id']}  name={s.get('name')!r}  devices={len(devs)}  categories={cats}"
            )
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
