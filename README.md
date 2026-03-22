# Granitka71 Order Management System

## О проекте

Granitka71 — CRM система для управления заказами на изготовление памятников.

Система автоматизирует полный цикл работы:

* создание и ведение заказов
* расчет стоимости
* управление работами и платежами
* работа с фото и видео
* использование карты и маршрутов
* архивирование заказов

## Технологии

### Backend

* ASP.NET Core Web API
* Entity Framework Core
* PostgreSQL
* JWT Authentication
* Cookie authentication (для media)
* Repository pattern
* DTO архитектура
* Swagger

### Frontend

* React 18
* TypeScript
* Vite
* React Query
* Axios
* Zustand
* React Hook Form
* Zod
* CSS Modules
* Модульная архитектура

##База данных 
*PostgreSQL

## Архитектура системы

Общая схема:

Frontend (React)
↓
ASP.NET Core API
↓
EF Core
↓
PostgreSQL + File Storage

### Backend архитектура

* Controller → Repository → DbContext → Database
* DTO → Mapping → Entity

### Frontend архитектура

* Feature-based структура
* shared/ui — единая дизайн-система
* Основные модули:

  * orders
  * users
  * plots
  * profile
  * media
  * auth

## Роли пользователей

* Главный администратор (SuperAdmin) — полный доступ
* Администратор — управление пользователями и заказами
* Менеджер — доступ только к своим заказам

## Основные функции

### Заказы

* Создание
* Редактирование
* Просмотр
* Архив
* Восстановление
* Полное удаление

### Финансы

* Автоматический расчет на backend
* Скидка 0–10%
* Платежи
* Статусы оплаты:

  * Advance (0–30%)
  * PartiallyPaid (31–99%)
  * FullyPaid (100%)

### Работы

* Добавление работ
* Расчет стоимости
* Автоматический subtotal

### Карта

* Yandex Maps
* 1 точка — участок
* 2 точка — пользователь
* Построение маршрута
* Расчет расстояния

### Media (Фото / Видео)

* Загрузка
* Предпросмотр
* Просмотр в модальном окне
* Скачивание
* Видео streaming

Особенности:

* Только через API
* Нет прямого доступа к файлам
* Видео поддерживает перемотку
* Используется cookie auth

### Temp uploads

Поток:

Upload → Temp → Commit → Order

## Soft Delete система

### Мягкое удаление

* заказ уходит в архив
* media остаётся

### Полное удаление

* удаляется заказ
* удаляются файлы orders/{id}

## Формы

Используется:

* React Hook Form
* Zod

### Структура формы заказа

* ClientSection
* DeceasedSection
* LocationSection
* MonumentSection
* WorksSection
* TotalsSection
* PaymentsSection
* MediaSection
* AdditionalInfoSection

## UI система

shared/ui:

* surface
* button
* input
* table
* modal
* status
* form-layout

## Безопасность

* JWT
* HttpOnly cookie (media)
* Роли пользователей
* Ограничение доступа к заказам
* EF Core защита от SQL-инъекций
* HTTPS

## Авторизация

### Backend

* JWT access token
* cookie media_auth

### Frontend

* axios interceptors
* refresh token
* React Query
