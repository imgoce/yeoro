# app/clients/__init__.py

from app.clients.tourism import TourismApiClient, TourismApiError
from app.clients.kakaomap import KakaoMapApiClient, KakaoMapApiError
from app.clients.weather import WeatherApiClient, WeatherApiError
from app.clients.kakao import KakaoAuthApiClient, KakaoAuthApiError

# 외부에서 'from app.clients import *' 또는 개별 임포트를 편하게 하기 위한 정의
__all__ = [
    "TourismApiClient",
    "TourismApiError",
    "KakaoMapApiClient",
    "KakaoMapApiError",
    "WeatherApiClient",
    "WeatherApiError",
    "KakaoAuthApiClient",
    "KakaoAuthApiError",
]