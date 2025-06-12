# from datetime import datetime, timedelta
# from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Query
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import JSONResponse
# from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
# from sqlalchemy.orm import Session
# from typing import List, Optional
# from passlib.context import CryptContext
# from jose import JWTError, jwt
# import datetime

# from . import database

# from .... import models, schemas

# # Create tables
# models.Base.metadata.create_all(bind=database.engine)

# # JWT Configuration
# SECRET_KEY = "your-secret-key-change-in-production"
# ALGORITHM = "HS256"
# ACCESS_TOKEN_EXPIRE_MINUTES = 30

# app = FastAPI(title="AirQo API")

# # Password hashing context
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# # OAuth2 setup
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# # Enable CORS
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# def verify_password(plain_password: str, hashed_password: str):
#     return pwd_context.verify(plain_password, hashed_password)

# def get_password_hash(password: str):
#     return pwd_context.hash(password)

# def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
#     to_encode = data.copy()
#     if expires_delta:
#         expire = datetime.datetime.utcnow() + expires_delta
#     else:
#         expire = datetime.datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
#     to_encode.update({"exp": expire})
#     return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
#     credentials_exception = HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="Could not validate credentials",
#         headers={"WWW-Authenticate": "Bearer"},
#     )
#     try:
#         payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
#         email: str = payload.get("sub")
#         if email is None:
#             raise credentials_exception
#     except JWTError:
#         raise credentials_exception
    
#     user = db.query(models.User).filter(models.User.email == email).first()
#     if user is None:
#         raise credentials_exception
#     return user

# @app.get("/")
# def read_root():
#     return {"message": "Hello from AirQo API"}

# @app.post("/create-admin")
# def create_admin(db: Session = Depends(database.get_db)):
#     existing_admin = db.query(models.User).filter(
#         models.User.email == "kasasatrevor25@gmail.com"
#     ).first()
    
#     if existing_admin:
#         return {"message": "Admin user already exists"}
    
#     admin_user = models.User(
#         email="kasasatrevor25@gmail.com",
#         password_hash=get_password_hash("Admin@2001"),
#         first_name="kasasa",
#         last_name="trevor",
#         role="admin",
#         status="active",
#         created_at=datetime.datetime.utcnow(),
#         updated_at=datetime.datetime.utcnow()
#     )
    
#     db.add(admin_user)
#     db.commit()
    
#     return {
#         "message": "Admin user created successfully",
#         "email": "kasasatrevor25@gmail.com",
#         "password": "Admin@2001"
#     }

# @app.post("/login")
# def loginCall():
#     return {"message": "Login Function"}


# @app.post("/login")

# def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
#     print(f"User created successfully: {user.email}")

#     user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
#     if not user or not verify_password(form_data.password, user.password_hash):
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid email or password",
#             headers={"WWW-Authenticate": "Bearer"},
#         )
    
#     access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
#     access_token = create_access_token(
#         data={"sub": user.email}, expires_delta=access_token_expires
#     )
    
#     return {
#         "access_token": access_token,
#         "token_type": "bearer",
#         "user": {
#             "id": user.id,
#             "email": user.email,
#             "first_name": user.first_name,
#             "last_name": user.last_name,
#             "role": user.role,
#             "status": user.status
#         }
#     }

# # User management endpoints
# @app.get("/users/", response_model=List[schemas.User])
# def get_users(
#     skip: int = 0,
#     limit: int = Query(100, le=100),
#     db: Session = Depends(database.get_db),
#     current_user: models.User = Depends(get_current_user)
# ):
#     """Get all users (admin only)"""
#     if current_user.role != "admin":
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Only admin users can access this endpoint"
#         )
#     users = db.query(models.User).offset(skip).limit(limit).all()
#     return users

# @app.post("/users/", response_model=schemas.User)
# def create_user(
#     user: schemas.UserCreate,
#     db: Session = Depends(database.get_db),
#     current_user: models.User = Depends(get_current_user)
# ):
#     """Create a new user (admin only)"""
#     if current_user.role != "admin":
#         raise HTTPException(
#             status_code=status.HTTP_403_FORBIDDEN,
#             detail="Only admin users can access this endpoint"
#         )
    
#     db_user = db.query(models.User).filter(models.User.email == user.email).first()
#     if db_user:
#         raise HTTPException(status_code=400, detail="Email already registered")
    
#     hashed_password = get_password_hash(user.password)
#     db_user = models.User(
#         email=user.email,
#         password_hash=hashed_password,
#         first_name=user.first_name,
#         last_name=user.last_name,
#         role=user.role,
#         status=user.status,
#         phone=user.phone,
#         location=user.location,
#         created_at=datetime.datetime.utcnow(),
#         updated_at=datetime.datetime.utcnow()
#     )
#     db.add(db_user)
#     db.commit()
#     db.refresh(db_user)
#     return db_user