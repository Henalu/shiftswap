# API Reference — ShiftSwap

> Endpoints del MVP. Todos requieren autenticación excepto los de auth.

## Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/register | Registro de usuario |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |

## Shifts
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/shifts | Listar turnos disponibles |
| POST | /api/shifts | Publicar un turno |
| GET | /api/shifts/:id | Detalle de un turno |
| PATCH | /api/shifts/:id | Actualizar turno (owner) |
| DELETE | /api/shifts/:id | Cancelar turno (owner) |

## Shift Requests
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/shifts/:id/requests | Mostrar interés en un turno |
| PATCH | /api/requests/:id | Aceptar/rechazar solicitud |

## Exchanges
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/exchanges | Crear intercambio |
| PATCH | /api/exchanges/:id | Confirmar intercambio |
| GET | /api/exchanges/:id/document | Descargar PDF |

## Messages
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/conversations | Listar conversaciones |
| GET | /api/conversations/:id/messages | Mensajes de una conversación |
| POST | /api/conversations/:id/messages | Enviar mensaje |

## Filtros comunes (query params)
- `department_id` — Filtrar por departamento
- `status` — Filtrar por estado
- `date_from` / `date_to` — Rango de fechas
- `page` / `limit` — Paginación
