from fastapi import APIRouter

from app.constants.http_constants import API_V1_PREFIX

api_router = APIRouter(prefix=API_V1_PREFIX)
