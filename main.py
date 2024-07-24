from datetime import datetime, timedelta
import jwt
import os
from passlib.context import CryptContext
from databases import Database
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.future import select
from sqlalchemy.orm import sessionmaker, joinedload, relationship
from sqlalchemy.exc import IntegrityError
from starlette.applications import Starlette
from starlette.authentication import AuthCredentials, AuthenticationBackend, SimpleUser, requires
from starlette.exceptions import HTTPException
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, RedirectResponse
from starlette.routing import Route, Mount
from starlette.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
from starlette.requests import Request

Base = declarative_base()

DATABASE_URL = "postgresql+asyncpg://gleb:9mLxoYEdiqdk5rAAYEmfYVM89VjksTQM@dpg-cqf99208fa8c73ene5v0-a:5432/manager_yscq"
database = Database(DATABASE_URL)
engine = create_async_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# Шаблоны
current_directory = os.path.dirname(os.path.abspath(__file__))
index = Jinja2Templates(directory=current_directory)
templates = Jinja2Templates(directory="templates")

SECRET_KEY = "PRAKTIKA2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 3000

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    completed = Column(Boolean, default=False)
    heading = Column(Text)
    task_text = Column(Text)
    user = relationship("User", back_populates="tasks")

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True)
    login = Column(String)
    password = Column(String)
    tasks = relationship("Task", back_populates="user")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=10080)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

from starlette.authentication import UnauthenticatedUser

class JWTAuthanticationBackend(AuthenticationBackend):
    async def authenticate(self, request):
        if "authorization" not in request.headers:
            return AuthCredentials(), UnauthenticatedUser()

        auth = request.headers["authorization"]
        try:
            scheme, token = auth.split()
        except ValueError:
            return AuthCredentials(), UnauthenticatedUser()

        if scheme.lower() != "bearer":
            return AuthCredentials(), UnauthenticatedUser()

        payload = decode_access_token(token)
        if payload is None:
            return AuthCredentials(), UnauthenticatedUser()

        user_id = int(payload["sub"])  # Преобразуем в int
        return AuthCredentials(["authenticated"]), SimpleUser(user_id)

async def homepage(request):
    return index.TemplateResponse("index.html", {"request": request})

async def lk_page(request):
    return templates.TemplateResponse("LK.html", {"request": request})

async def registration(request: Request):
    data = await request.json()
    
    async with SessionLocal() as session:
        async with session.begin():
            try:
                existing_user = await session.execute(
                    select(User).filter(User.login == data["login"])
                )
                if existing_user.scalar_one_or_none():
                    return JSONResponse({"error": "Пользователь с таким логином уже зарегистрирован!"}, status_code=400)

                user = User(
                    login=data["login"], password=get_password_hash(data["password"])
                )
                session.add(user)
                await session.commit()
                return JSONResponse({"message": "Регистрация прошла успешно."})
            except IntegrityError:
                await session.rollback()
                return JSONResponse({"error": "Ошибка."}, status_code=400)
            except Exception as e:
                await session.rollback()
                return JSONResponse({"error": str(e)}, status_code=400)

async def auth(request: Request):
    data = await request.json()
    async with SessionLocal() as session:
        async with session.begin():
            result = await session.execute(
                select(User).filter(User.login == data["login"])
            )
            user = result.scalar_one_or_none()
    if user and verify_password(data["password"], user.password):
        token = create_access_token(data={"sub": user.user_id})
        return JSONResponse({"access_token": token}, status_code=200)
    return JSONResponse({"error": "Неверный логин или пароль"}, status_code=401)

@requires("authenticated")
async def delete_task(request):
    task_id = int(request.path_params["task_id"]) 
    user_id = int(request.user.username)

    async with SessionLocal() as session:
        async with session.begin():
            result = await session.execute(
                select(Task).filter(Task.task_id == task_id, Task.user_id == user_id)
            )
            task = result.scalar_one_or_none()
            
            if task is None:
                return JSONResponse({"error": "Задача не найдена"}, status_code=404)

            # Удаляем задачу
            await session.delete(task)
            await session.commit()

    return JSONResponse({"message": f"Задача с айди={task_id} была удалена"})

@requires("authenticated")
async def get_task_by_id(request):
    task_id = int(request.path_params["task_id"])
    user_id = int(request.user.username)

    async with SessionLocal() as session:
        async with session.begin():
            result = await session.execute(
                select(Task).filter(Task.task_id == task_id, Task.user_id == user_id)
            )
            task = result.scalar_one_or_none()

    if task:
        task_dict = {
            "task_id": task.task_id,
            "user_id": task.user_id,
            "completed": task.completed,
            "heading": task.heading,
            "task_text": task.task_text,
        }
        return JSONResponse(task_dict)
    else:
        return JSONResponse({"error": "Task not found"}, status_code=404)
    
@requires("authenticated")
async def get_now_tasks(request):
    user_id = int(request.user.username)
    async with SessionLocal() as session:
        async with session.begin():
            results = await session.execute(
                select(Task).filter(Task.user_id == user_id, Task.completed == False)
            )
            tasks = results.scalars().all()

    tasks_list = []
    for task in tasks:
        task_dict = {
            "task_id": task.task_id,
            "user_id": task.user_id,
            "completed": task.completed,
            "heading": task.heading,
            "task_text": task.task_text,
        }
        tasks_list.append(task_dict)

    return JSONResponse(tasks_list)

@requires("authenticated")
async def get_completed_tasks(request):
    user_id = int(request.user.username)
    async with SessionLocal() as session:
        async with session.begin():
            results = await session.execute(
                select(Task).filter(Task.user_id == user_id, Task.completed == True)
            )
            tasks = results.scalars().all()

    tasks_list = []
    for task in tasks:
        task_dict = {
            "task_id": task.task_id,
            "user_id": task.user_id,
            "completed": task.completed,
            "heading": task.heading,
            "task_text": task.task_text,
        }
        tasks_list.append(task_dict)

    return JSONResponse(tasks_list)

@requires("authenticated")
async def create_task(request):
    data = await request.json()
    user_id = int(request.user.username)
    heading = data.get("heading")
    task_text = data.get("task_text")
    completed = data.get("completed", False)

    async with SessionLocal() as session:
        async with session.begin():
            # Создаем новую задачу
            task = Task(
                user_id=user_id,
                heading=heading,
                task_text=task_text,
                completed=completed,
            )
            session.add(task)
            await session.commit()
            
            response_data = {
                "task_id": task.task_id,
                "user_id": task.user_id,
                "heading": task.heading,
                "task_text": task.task_text,
                "completed": task.completed,
            }
            
            return JSONResponse(response_data, status_code=201)

@requires("authenticated")
async def update_task(request):
    data = await request.json()
    user_id = int(request.user.username)
    task_id = int(request.path_params["task_id"])
    heading = data.get("heading")
    task_text = data.get("task_text")
    completed = data.get("completed", False)

    async with SessionLocal() as session:
        async with session.begin():
            task = await session.get(Task, task_id)
            if task and task.user_id == user_id:
                # Обновляем задачу
                task.heading = heading
                task.task_text = task_text
                task.completed = completed
                await session.commit()

                response_data = {
                    "task_id": task.task_id,
                    "user_id": user_id,
                    "heading": heading,
                    "task_text": task.task_text,
                    "completed": task.completed,
                }
                return JSONResponse(response_data, status_code=200)
            else:
                return JSONResponse({"error": "Задача не найдена или не принадлежит пользователю"}, status_code=404)

@requires("authenticated")
async def complete_task(request):
    task_id = int(request.path_params["task_id"])
    user_id = int(request.user.username)

    async with SessionLocal() as session:
        async with session.begin():
            result = await session.execute(
                select(Task).filter(Task.task_id == task_id, Task.user_id == user_id)
            )
            task = result.scalar_one_or_none()

            if task is None:
                return JSONResponse({"error": "Задача не найдена"}, status_code=404)

            task.completed = True
            await session.commit()

    return JSONResponse({"message": "Задача завершена"})

@requires("authenticated")
async def resume_task(request):
    task_id = int(request.path_params["task_id"])
    user_id = int(request.user.username)

    async with SessionLocal() as session:
        async with session.begin():
            result = await session.execute(
                select(Task).filter(Task.task_id == task_id, Task.user_id == user_id)
            )
            task = result.scalar_one_or_none()

            if task is None:
                return JSONResponse({"error": "Задача не найдена"}, status_code=404)

            task.completed = False
            await session.commit()

    return JSONResponse({"message": "Задача возобновлена"})

routes = [
    Route("/", homepage),
    Route("/index.html", homepage),
    Route("/LK.html", lk_page),
    Mount("/static", StaticFiles(directory="static"), name="static"),
    Route("/registration", registration, methods=["POST"]),
    Route("/auth", auth, methods=["POST"]),
    Route("/create_task", create_task, methods=["POST"]),
    Route("/tasks", get_now_tasks, methods=["GET"]),
    Route("/tasks_completed", endpoint=get_completed_tasks, methods=["GET"]),
    Route("/tasks/{task_id:int}", get_task_by_id, methods=["GET"]),
    Route("/tasks/{task_id:int}", endpoint=update_task, methods=["PUT"]),
    Route("/tasks/{task_id}", endpoint=delete_task, methods=["DELETE"]),
    Route("/tasks/{task_id}/complete", complete_task, methods=["PATCH"]),
    Route("/tasks/{task_id}/resume", resume_task, methods=["PATCH"]),
]

app = Starlette(debug=True, routes=routes)
app.add_middleware(AuthenticationMiddleware, backend=JWTAuthanticationBackend())
