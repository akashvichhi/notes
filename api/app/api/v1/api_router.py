from fastapi import APIRouter

from app.api.v1.routers.auth_router import auth_router
from app.api.v1.routers.folder_router import folder_router
from app.api.v1.routers.profile_router import profile_router
from app.api.v1.routers.tag_router import tag_router
from app.constants.http_constants import API_V1_PREFIX

api_router = APIRouter(prefix=API_V1_PREFIX)
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(folder_router)
api_router.include_router(tag_router)
