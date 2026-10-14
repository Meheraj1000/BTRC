# Nirapad Transit — Final FYDP Documentation

## 1. Project title
Nirapad Transit — AI-Enabled National Smart Public Transport Management and Safety System Using GPS and Real-Time Monitoring for Bangladesh

## 2. Abstract
This project is an academic FYDP platform that demonstrates a multi-role public transport management system for Bangladesh. It includes authentication, role-based access control, fleet management, GPS tracking, route compliance, emergency workflow, notifications, analytics, and a synthetic AI/ML research prototype. The project is intentionally presented as a demo/simulation environment rather than a connected national government or telecom deployment.

## 3. Problem statement
Public transport monitoring and safety operations require visibility across buses, drivers, routes, incidents, complaints, alerts, and passenger reporting. The project addresses this using a centralized digital platform for operational monitoring and route oversight in a demo environment.

## 4. Objectives
- implement a role-aware transport management platform
- support admin, owner, government, police, BRTA, driver, and passenger flows
- provide GPS ingestion and monitoring for demo fleet state
- improve route compliance and emergency visibility
- preserve ownership and privacy boundaries
- provide analytics and reporting for operational dashboards
- maintain a synthetic AI/ML experimental module clearly labeled as non-production

## 5. Scope
The implemented system covers the platform architecture, demo fleet workflows, core service APIs, live map monitoring, operational analytics, and security boundaries. It does not claim real government integration, live policing dispatch, or physical GPS hardware deployment.

## 6. Users and roles
- SUPER_ADMIN
- GOVERNMENT
- BRTA
- POLICE
- TRANSPORT_OWNER
- DRIVER
- PASSENGER

## 7. Features
- JWT auth and RBAC
- bus/driver/route management
- GPS ingestion and validation
- latest location and history APIs
- route compliance and deviation logic
- owner portal
- government/admin monitoring dashboards
- police emergency monitoring
- passenger app flows
- SOS workflow
- complaint and lost & found
- notifications and Socket.IO events
- analytics and reporting
- synthetic ETA ML experiment

## 8. Technology stack
- Web: Next.js 14 + React + TypeScript + Tailwind
- API: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Realtime: Socket.IO
- Maps: Leaflet + OpenStreetMap
- Mobile: Flutter source
- AI/ML: Python + scikit-learn + XGBoost (experimental, synthetic)
- Ops: Docker Compose

## 9. Architecture
Frontend -> Next.js app
Backend -> Express API + JWT + RBAC + Prisma
Database -> PostgreSQL
Realtime -> Socket.IO
Maps -> Leaflet/OpenStreetMap
GPS -> demo simulator or configured device source
Analytics -> backend service layer
AI/ML -> separate experimental Python module

## 10. Database overview
The database models support users, roles, permissions, companies, buses, drivers, routes, trips, GPS data, SOS, alerts, complaints, notifications, lost & found entries, and audit logs. The project uses Prisma and seeded demo data labeled as demo/simulation.

## 11. Authentication and RBAC
Authentication is implemented through JWT access tokens and hashed refresh tokens. Authorization is enforced server-side using role permissions and ownership checks. All privileged access is validated on the backend, not only in the UI.

## 12. GPS system
The application includes a live/simulated GPS workflow with validation and access restrictions. GPS data is treated as sensitive operational information and is only exposed to authorized roles and relevant resource owners.

## 13. Route compliance
Routes, stops, and assignment records support compliance checks and deviation logic. The system can detect route-related issues through the operational service layer and surface them to authorized monitoring roles.

## 14. Emergency and SOS
Emergency workflow includes SOS creation, monitoring, status updates, notifications, and audit logging. The design is application-level and does not claim integration with real emergency dispatch systems.

## 15. Complaint and Lost & Found
The project supports passenger complaint management and staff/admin coordination, plus a lost-and-found workflow with ownership/privacy controls. Internal notes remain protected from unauthorized users.

## 16. Notifications
Notifications are persisted and emitted through the realtime layer to the correct user or role-based audience. Notification privacy and ownership checks remain in place.

## 17. Analytics
The analytics layer includes dashboards, summaries, route analytics, bus analytics, driver analytics, alert monitoring, and real database-backed operational reporting. These are implemented and verified as operational analytics.

## 18. AI/ML experimental scope
The project contains an experimental ETA pipeline in the ml/ folder. It uses synthetic data generated locally and does not claim real Bangladesh transport performance or national prediction accuracy.

## 19. Security and privacy
The project implements server-side authentication, authorization, ownership checks, rate limiting, input validation, privacy scoping, audit logging, and safe logging patterns. The system has been verified against the existing project architecture and remains an academic/demo build rather than a national production system.

## 20. Testing and performance
The backend test suite has passed in the verified environment. Frontend production build also passes. Performance checks were done against the existing demo environment and are aligned with FYDP/demo usage rather than national-scale production capacity claims.

## 21. Deployment status
The project is ready for FYDP/demo deployment within its intended environment. It is not a government production deployment, telecom-grade service, or certified national system.

## 22. Limitations
- GPS is demo/simulation unless DEVICE mode is configured
- no real national transport dataset is included
- no production AI model is installed
- no real government/BRTA database integration is claimed
- no real police/ambulance/fire/999 dispatch integration is claimed
- Flutter build verification is environment-limited if SDK is unavailable

## 23. Future work
- real historical trip/GPS dataset collection
- production-grade predictive modeling
- operational monitoring improvements
- stronger production deployment hardening
- actual external system integration only if authorized and implemented

## 24. Demo instructions
- copy environment files from their examples
- install Node dependencies
- generate Prisma client and seed demo data
- run backend, frontend, and simulator
- use seeded demo accounts
- demonstrate monitoring, owner workflows, passenger access, and SOS/complaint flows

## 25. Final assessment
This project is a functioning FYDP demo platform with verified operational tooling and an explicitly experimental AI/ML layer. It is ready for demonstration and academic evaluation within the documented scope and limitations.
