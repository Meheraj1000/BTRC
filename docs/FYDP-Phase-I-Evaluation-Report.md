# FYDP (Phase-I) Evaluation Report

**Department of Computer Science and Engineering**  
**Daffodil International University**  
**Reporting period: Fall 2026**  
**Template: FYDP (Phase-I) Evaluation Report, Version 2.0**

This draft fills every section of the department template from the work completed in the Nirapad Transit repository. Items that only the group and the supervisor can certify are left blank. Do not add accuracy percentages, dataset sizes, or a claim of live BRTA or police deployment. Those are not supported by the project.

---

## Project identification

| Item | Entry |
| --- | --- |
| I. Project title | Nirapad Transit: An AI-Enabled National Smart Public Transport Management and Safety System Using GPS and Real-Time Monitoring for Bangladesh |
| II. Group members | 1. Name: _______________ &nbsp;&nbsp; Student ID: _______________ |
| | 2. Name: _______________ &nbsp;&nbsp; Student ID: _______________ |
| | 3. Name: _______________ &nbsp;&nbsp; Student ID: _______________ |
| | 4. Name: _______________ &nbsp;&nbsp; Student ID: _______________ |
| III. Supervisor | Name: _______________ |
| | Designation: _______________ |
| IV. Co-supervisor | Name: _______________ |
| | Designation: _______________ |
| V. Submission date | _______________ |
| VI. Certificate | This is to certify that the final year design project work until Phase-I evaluation held on _______________, titled as stated in Sec. I, executed by the students’ group mentioned in Sec. II, have been found satisfactory and every section of this report is reflecting the same. |

**Signature of supervisor and date:** _______________

### Thematic areas

| Area | Selected |
| --- | --- |
| Artificial Intelligence and Machine Learning | Yes. A rule-based ETA and an experimental model comparison on synthetic data are included. They are not a production predictor. |
| Deep Learning | No |
| Health Informatics | No |
| Cybersecurity | Yes, in the limited sense of authentication, role-based access, rate limiting, and audit logs. This is not a cybersecurity research project. |
| Software Engineering and Development | Yes. This is the main body of the work. |
| Blockchain Technology | No |
| Internet of Things (IoT) | Yes, as a GPS ingest design. Phase I uses a simulator. A physical tracker is not connected. |
| Computer Networks | Yes. The live site, REST API, and real-time location updates are networked components. |
| Computer Vision | No. QR scanning reads a printed code. It does not analyse images for recognition. |
| Natural Language Processing | No |
| Robotics | No |
| Game Development | No |
| Cloud Computing | Yes. The web application has been deployed for demonstration. The API still depends on the development machine. |
| Image Processing | No |
| Others | Intelligent transport systems and public-service software for Bangladesh. |

### Software packages, tools, and programming languages

| Layer | Tools and languages |
| --- | --- |
| Languages | TypeScript, JavaScript, SQL, Python, Dart (Flutter source) |
| Web | Next.js 14, React 18, Tailwind CSS, Leaflet, OpenStreetMap tiles, html5-qrcode |
| API | Node.js 20 or newer, Express 4, Prisma 6, Socket.IO 4, Zod, Helmet, bcryptjs, JSON Web Token, express-rate-limit, Winston |
| Data | PostgreSQL 16. Redis 7 is listed in Docker Compose but is not called by the application code. |
| Reports | csv-stringify, ExcelJS, PDFKit |
| Mobile | Flutter source for passenger and driver clients. A device build was not treated as verified evidence. |
| Machine learning | pandas, NumPy, scikit-learn, XGBoost, Matplotlib, Joblib, Jupyter. Training is local and optional. |
| Test and delivery | Vitest, Supertest, Docker Compose, Git, Vercel for the web demonstration |
| Maps and time | OpenStreetMap through Leaflet. Display time zone is Asia/Dhaka. Stored timestamps are UTC. |

---

## Course outcomes addressed in Phase I

The outcome statements below keep the department’s Phase-I intent and name this project. The sample crop-disease wording in the blank template is not this project.

| CO | Description | PO |
| --- | --- | --- |
| CO4 | Perform economic evaluation, cost estimation, and apply suitable project management procedures throughout the FYDP lifecycle while developing Nirapad Transit. | PO11 |
| CO6 | Select and apply appropriate methodologies, resources, and contemporary engineering and IT tools for design, modelling, and implementation of Nirapad Transit. | PO5 |
| CO7 | Assess societal, health, safety, legal, and cultural responsibilities related to a public-transport monitoring system used in Bangladesh. | PO6 |
| CO10 | Operate effectively as an individual and as a member or leader of the project group during requirements, implementation, testing, and reporting. | PO9 |

---

## 1. Project overview

### 1.1 Introduction

Public buses in Bangladesh are now expected to carry a working GPS device, and regulators want to see location, route, and speed from a central point. Passengers, owners, drivers, the Bangladesh Road Transport Authority (BRTA), and the police do not all need the same screen or the same data. Nirapad Transit is a final-year design of one web platform that gives each of those roles a separate, permission-checked view of the same fleet.

The goal of Phase I is a working academic system that can be demonstrated honestly. A person can sign in as an administrator, a government user, a BRTA user, a police user, a bus owner, a driver, or a passenger. The demonstration fleet moves on a map, leaves a route or exceeds a speed limit under simulator control, and can raise an in-application SOS or complaint. The system states on screen that locations are simulated and that a real emergency must be reported by calling 999.

The project does not replace BRTA, a police control room, or a vehicle-tracking company. It shows the software structure those organisations would need, using demo records and a GPS simulator.

### 1.2 Background study

The World Health Organization’s 2023 country profile for Bangladesh reports 5,084 officially reported road-traffic fatalities in 2021 and a WHO estimate of about 31,578 deaths in the same year. The profile also records periodic technical inspection of vehicles and a national road-safety strategy [1]. Buses are one part of that risk. Passengers and regulators still have limited shared visibility of where a bus is, which driver is assigned, and whether it is on the permitted route.

The Road Transport Act, 2018, and the Road Transport Rules, 2022, already give BRTA a legal basis for vehicle fitness, registration, and technical conditions. In 2026 the Road Transport and Highways Division and BRTA required GPS devices on public-transport vehicles, with proof of an operating tracker linked to registration and fitness renewal. Public reporting of that notice describes central monitoring of location, route, and speed, including overspeed and route-departure alerts, and a role for BRTA and law enforcement [2], [3]. A separate feasibility study has been commissioned to plan a national GPS-based intelligent transport system for BRTA [4].

A JSON Web Token is a compact, signed way to carry a signed-in user’s identity between a browser and an API [5]. Role checks must still happen on the server. Map display in this project uses the public OpenStreetMap tile service through Leaflet, which avoids a paid map licence for the academic demo [6]. Tree-based models such as gradient boosting and XGBoost are established tools for tabular prediction [7], [8]. They are used here only as an experiment, because the repository does not contain a licensed national GPS archive.

### 1.3 Gap analysis

The background study shows four gaps that this phase addresses in software, and one gap it deliberately does not pretend to close.

1. **One official feed, many users.** A national tracker can collect points. Passengers, owners, drivers, BRTA, and the police still need different pages and must not see one another’s private records.
2. **Rules before predictions.** Overspeed and route departure can be detected with published thresholds. A learned accident or traffic model needs history this project does not have.
3. **A safe place to practise.** Students cannot connect a class project to the live BRTA server or a police dispatch line. A labelled simulator and demo accounts are required.
4. **Plain operation.** A monitoring screen that shows codes such as `STALE` or `ON_ROUTE` is difficult for a non-technical user, including when the interface is in Bangla.
5. **What remains open.** No physical GPS modem is attached, no BRTA database is queried, and the emergency button does not call 999. Those are outside the verified Phase-I system.

---

## 2. Objectives

Phase I set out to do the following, and the repository now contains a demonstration of each item.

1. Specify a seven-role transport platform for Bangladesh and keep every privileged action checked on the server.
2. Store users, companies, buses, drivers, routes, trips, GPS points, alerts, SOS requests, complaints, lost-and-found items, notifications, and audit records in PostgreSQL.
3. Accept GPS updates from a simulator, keep the latest point separate from history, and draw buses on a Bangladesh map.
4. Raise rule-based overspeed and route-deviation alerts and show them to the roles allowed to see them.
5. Provide passenger, driver, owner, police, BRTA, government, and administrator workflows, including SOS, complaints, reports, and notifications.
6. Offer English and Bangla labels, and put a short explanation on each signed-in page.
7. Separate an experimental ETA study, trained only on synthetic rows, from the working rule-based ETA.
8. Document what is implemented, what is simulated, and what must not be claimed at the evaluation.

---

## 3. Methodology and requirement specification

### 3.1 Research design and prototype design

The work is a design-and-build prototype, not a field trial. Requirements were taken from the role of each user and written down as phased module notes in the repository, from architecture and the database through authentication, fleet records, GPS, compliance, dashboards, police monitoring, passenger flows, SOS, complaints, the owner portal, notifications, and the experimental model.

The running design is a single TypeScript and Node.js API in front of PostgreSQL, a Next.js web application for every role, a small GPS simulator, and a separate Python folder for the ETA experiment. The web application on the public demonstration address does not call the API from the phone directly. It forwards each request to the API address published for that session. That choice keeps the demonstration on one website while the API remains on the development computer.

```
Passenger, driver, owner, BRTA, police, government, administrator
                         |
                         v
              Next.js web application
                         |
                         v
         Express API, JWT, and role checks
                         |
           +-------------+-------------+
           |             |             |
     PostgreSQL     Socket.IO     Rule checks
                    location      speed and route
                         ^
                         |
               GPS simulator (demo)
                         |
               Python ETA experiment
               (synthetic, not wired in)
```

Access tokens identify the user. Refresh tokens are stored as hashes and rotated. GPS sent to a passenger is a smaller public record than the operational record used by police, government, BRTA, and administrators. Seeded companies, buses, drivers, and routes are named as demo data.

### 3.2 Data collection and need assessment

No survey of passengers and no extract from BRTA were collected. Need assessment used the published safety and GPS context in Section 1.2 and the tasks each role must finish in a demo:

| Role | Need the prototype supports |
| --- | --- |
| Passenger | Find a route or bus, scan a bus code, file a complaint or lost-and-found report, and send an in-app SOS |
| Driver | See the assigned bus and route, start and end a trip, share a simulated location, and send an SOS |
| Owner | See only that company’s buses, drivers, routes, trips, and complaints |
| Police | Look up a registration number, watch emergencies, and open alerts for the assigned area |
| BRTA | Review vehicle, driver, licence, fitness, and violation records in the demo database |
| Government | See a country-wide monitoring view without editing owner records |
| Administrator | Manage users and records and read the audit log |

GPS points in the demonstration are produced by `gps-simulator`, which moves demo buses along city corridors in Dhaka, Chattogram, Sylhet, Rajshahi, and Khulna. Each stored point can be marked as simulation. The machine-learning folder can generate 4,000 synthetic ETA rows on the developer’s machine. Those rows are not trips from Bangladesh.

### 3.3 Analysis techniques

| Question | Technique | How the result is treated |
| --- | --- | --- |
| Is the user allowed to open this record? | Role and ownership checks in the API, with Zod validation on input | Operational |
| Is the bus speeding or off the route? | Distance and speed rules, including consecutive off-route points before an alert | Operational, with thresholds set for the demo |
| When might the bus arrive? | Heuristic using distance, recent speed, and hour of day | Prototype endpoint. Not a learned model. |
| Which tabular model fits synthetic ETA rows? | Linear regression, random forest, gradient boosting, and XGBoost, scored with MAE, RMSE, and R² | Experimental. Metrics exist only after a local training run and are not copied into this report. |
| Does a module keep working? | Vitest and Supertest suites for authentication, GPS, routes, SOS, police, passengers, dashboards, and security | Evidence for the demo environment, not a national load test |

---

## 4. Progress achieved

### 4.1 Completed tasks

1. **Architecture and database.** The API, web app, simulator, and experimental model are separate folders. Prisma models cover users, roles, permissions, police areas, companies, buses, GPS devices, routes, stops, assignments, trips, GPS history, latest GPS, compliance events, alerts, SOS, complaints, lost and found, notifications, cameras, and audit logs.
2. **Authentication and access control.** Sign-in issues an access token and a rotating refresh token. Seven roles are enforced on the server. Demo accounts are seeded. The practice password is shown on the sign-in page because the accounts are not real government credentials.
3. **Fleet records.** Administrators and owners can work with companies, buses, drivers, routes, and GPS-device records within their permission. Buses can carry a QR token for the passenger scan flow.
4. **Live map and compliance.** The simulator posts locations. The API keeps a latest-point table and a history table. The map uses green, yellow, and red cues. Overspeed and route-deviation rules create alerts.
5. **Safety workflows.** Passengers and drivers can create an SOS. Police and government desks can see and update that workflow. Complaints and lost-and-found items have ownership rules. Notifications are stored and can be pushed over Socket.IO on the development server.
6. **Monitoring desks and reports.** Administrator, government, BRTA, police, and owner dashboards read the demo database. Authorised users can download CSV, Excel, and PDF reports.
7. **Passenger and driver web flows.** Passengers can search routes, open a bus, scan a code, and see a boarded-bus page. Drivers can open the assigned bus, route, and trip pages.
8. **Language and explanation.** The interface switches between English and Bangla. Each signed-in page states what the user can do there. Status values are shown in words, for example “Location is out of date” rather than a raw code. A banner tells the user to call 999 in a real emergency.
9. **Tests and deployment notes.** Backend tests cover the modules above. The web app has been built and published for demonstration. The public site forwards API calls to a tunnel on the development computer. That tunnel is a demo aid, not a permanent national host.
10. **Experimental ETA folder.** Scripts can generate synthetic rows and compare scikit-learn and XGBoost models. The API does not load those saved models.

### 4.2 Results obtained

The following behaviour has been observed on the development stack and, for sign-in, on the published demonstration site. No predictive accuracy is stated, because the trainer has not been cited here with a saved metrics file.

| Check | Observed result |
| --- | --- |
| Health of the API | The local API returns a success response when PostgreSQL is running. |
| Sign-in | A seeded passenger account receives an access token from the published website when the development API and its public link are up. |
| Role separation | Each role is sent to its own home page. Server checks reject roles that do not own the record. |
| Map | Simulated buses appear on the OpenStreetMap view and move when the simulator runs. |
| Alerts | Turning simulator overspeed or deviation on produces alerts for authorised desks. |
| SOS and complaints | A passenger SOS is visible on the police and government monitoring pages. A complaint can be created and reviewed by an authorised user. |
| Reports | CSV, Excel, and PDF downloads are implemented for authorised report pages. |
| Language | Switching to Bangla translates navigation, the page explanation, and common status words. |
| Model scores | Not reported. The project rule is to copy MAE, RMSE, and R² only from `ml/results/eta_metrics.json` after training on that machine. |

---

## 5. Challenges faced

| No. | Issue or challenge | Strategy or plan |
| --- | --- | --- |
| 1 | A student project must not be described as a live BRTA or police system. | Demo names, a simulation banner, and written limits in the README and this report. Real emergencies are directed to 999. |
| 2 | There is no licensed historical GPS archive for training. | Rule-based alerts in the API. The learning experiment uses a synthetic generator and does not publish invented scores. |
| 3 | The published website cannot keep a permanent Socket.IO server. | The browser on that site uses HTTP polling for live updates. Socket.IO remains available when the API runs as a long-lived Node process. |
| 4 | The demonstration API runs on a development computer. Its temporary public link closes when that computer, Docker, or the link process stops, and sign-in then returns “service unavailable.” | Document the dependency. Restart Docker, the API, and the link before a demonstration. A later phase should use one stable host instead of a temporary link. |
| 5 | Passengers and officers should not receive the same GPS detail. | Separate public and operational location records, with the fuller record limited to authorised roles. |
| 6 | Raw status codes and English-only labels make the demo hard to follow. | Page explanations, plain status words, and a Bangla dictionary for the interface. |
| 7 | Many modules had to stay consistent as roles and tables grew. | One API, Prisma migrations, role tests, and a short phase note for each module. |

---

## 6. Next steps

| No. | Next task | Estimate of completion |
| --- | --- | --- |
| 1 | Run the ETA trainer locally, save the metrics file, and report only those numbers. Decide whether the API should call that model. | 12-26 |
| 2 | Replace the temporary public link with one stable demonstration host so sign-in does not depend on a laptop tunnel. | 01-27 |
| 3 | Connect one physical GPS device in device mode and compare its points with the simulator. | 02-27 |
| 4 | Build and test the Flutter passenger and driver apps on a phone against the stable host. | 03-27 |
| 5 | Prepare the Phase-II evaluation script: one path per role, with the simulation limits stated before any question. | 03-27 |

Month estimates assume the Fall 2026 Phase-I evaluation is followed by work through Spring 2027. The group should replace them if the department sets different dates.

---

## 7. Updated timeline

The week numbers follow the template. Shaded work is the progress already in the repository. Later weeks are the plan in Section 6. The group should slide this grid if the supervisor’s calendar uses different week numbers.

| Task | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Study, objectives, architecture | A | A |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2. Database, sign-in, and roles |  | A | A | A |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3. Fleet, driver, route, and company records |  |  |  | A | A | A |  |  |  |  |  |  |  |  |  |  |  |  |
| 4. GPS simulator, map, and route rules |  |  |  |  |  | A | A | A |  |  |  |  |  |  |  |  |  |  |
| 5. SOS, complaints, police, and government desks |  |  |  |  |  |  |  | A | A | A |  |  |  |  |  |  |  |  |
| 6. Passenger and driver pages, reports, Bangla text |  |  |  |  |  |  |  |  |  | A | A |  |  |  |  |  |  |  |
| 7. Experimental ETA scripts and this Phase-I report |  |  |  |  |  |  |  |  |  |  | A | A |  |  |  |  |  |  |
| 8. Stable host, device GPS, and phone apps |  |  |  |  |  |  |  |  |  |  |  |  | E | E | E | E | E | E |

**A** means work already reflected in the repository. **E** means estimated work for the next phase. Empty cells are not claimed as work.

---

## 8. Resources utilized

| Resource | Use in this phase |
| --- | --- |
| Student computers | Writing the API, web app, simulator, and report |
| Docker Desktop | PostgreSQL 16 for the demo database |
| Node.js and the open-source libraries in Section 3 | Application implementation and tests |
| Python environment | Optional synthetic ETA experiment |
| OpenStreetMap tile servers | Map background |
| Git and GitHub | Source history |
| Vercel | Hosting the web demonstration |
| A temporary tunnel on the development computer | Reaching the API from the published website |
| Department template and supervisor consultation | Structure and certification of this report |

No paid dataset, map licence, or GPS handset was required to reach the Phase-I demonstration.

---

## 9. Project management and financial analysis

### Management

Work was split by module rather than by a separate paid team. Each module has a short note in the repository covering what was built and what must not be claimed. The group should record, before submission, who led each module. A practical split that matches the software is:

| Work package | Suggested owner | Evidence |
| --- | --- | --- |
| Requirements, report, and demonstration script | Group leader | This report and the README |
| API, database, and access control | Member responsible for the backend | `backend/` and its tests |
| Web roles, map, and Bangla interface | Member responsible for the frontend | `frontend/` |
| Simulator, deployment, and backup demo | Member responsible for operations | `gps-simulator/` and the running Docker database |

Changes are kept in Git. Secrets, including database passwords and token signing keys, stay in environment files and are not part of the report. The demonstration is rehearsed only after Docker and the API both respond. That order avoids a failed sign-in during the evaluation.

### Cost estimate

Figures below are planning estimates for an academic build, not invoices and not a quotation for a national system.

| Item | Phase-I treatment | Estimated cash cost |
| --- | --- | --- |
| Developer licences for Node.js, PostgreSQL, Next.js, Prisma, Leaflet, Python, and scikit-learn | Open-source software already used | BDT 0 |
| Map tiles | Public OpenStreetMap service | BDT 0 |
| Web demonstration hosting | Free demonstration tier | BDT 0 |
| Database hosting | PostgreSQL on the students’ computer | BDT 0 |
| GPS handset and SIM | Not purchased in Phase I | BDT 0 now. Obtain a current price from a listed tracking vendor before any Phase-II purchase. |
| Laptops, electricity, and home internet | Already available for study | Not added as a project purchase |
| **Phase-I cash outlay** | | **BDT 0 beyond resources the students already had** |

A national deployment would cost far more: device installation on each bus, a mobile-data plan, a staffed server, support, and an authorised connection to BRTA. That cost is out of scope until an institution sponsors it. The economic choice in Phase I was to spend time on a complete role-based prototype instead of buying hardware that the university demo cannot legally attach to the national server.

---

## 10. Future considerations

1. **Legal boundary.** Reading or writing the live BRTA register, or sending an SOS into a police dispatch system, needs written permission. The prototype must keep saying that it is a simulation.
2. **Safety boundary.** The on-screen SOS does not contact an ambulance or a police unit. Evaluators and users must be told to call 999 for a real emergency.
3. **Privacy.** Location history can reveal a driver’s day. Operational detail stays with authorised roles, and the audit log records sensitive changes.
4. **Availability.** The current public demonstration fails when the student computer sleeps or Docker stops. Phase II should not depend on a temporary link.
5. **Model risk.** Publishing an ETA accuracy figure without the metrics file would mislead the examiners. Any future number must come from a rerun that the group can show.
6. **Language and access.** Bangla coverage should be checked on the passenger and police pages before the final defence, including on a phone-sized screen.
7. **Data quality.** Simulator points are smooth by design. A real device will include gaps, indoor error, and delayed reports. Device mode must tolerate those gaps before anyone calls the feed live.

---

## 11. Conclusion

Phase I produced a working, role-based public-transport platform for academic demonstration in Bangladesh. Administrators, government users, BRTA, police, owners, drivers, and passengers each have a path through the same database, with access checked on the server. Demo buses can be followed on a map, checked against speed and route rules, and used to practise SOS, complaint, notification, and report flows. English and Bangla labels, short page explanations, and an emergency banner make that demonstration easier to understand.

The intelligent part of the running system is rule-based. The machine-learning folder is a separate experiment on synthetic data and is not claimed as a national predictor. The published website can sign a user in only while the development API is running and reachable. Those limits are part of the result, not an afterthought. The next phase is a stable host, an honest ETA measurement, one real GPS trial, and a phone build, still without claiming a government deployment.

---

## References

[1] World Health Organization, “Bangladesh,” in *Global Status Report on Road Safety 2023: Country and Territory Profiles*. Geneva, Switzerland: WHO, 2023. [Online]. Available: https://cdn.who.int/media/docs/default-source/country-profiles/road-safety/road-safety-2023-bgd.pdf

[2] “GPS tracking mandatory for public transport from August 1,” *The Daily Star*, Jul. 27, 2026. [Online]. Available: https://www.thedailystar.net/news/news/gps-tracking-mandatory-public-transport-august-1-4234056

[3] “BRTA permits 26 companies to sell GPS devices for motor vehicle,” *Bonik Barta*, Aug. 16, 2026. [Online]. Available: https://en.bonikbarta.com/bangladesh/brQvjM00bCIKBfPX

[4] Geo-Planning for Advanced Development Ltd., “Feasibility study for deployment of Global Positioning System (GPS) in public transport (DGPS),” project note for the Bangladesh Road Transport Authority. [Online]. Available: https://www.gpad.com.bd/projects/193

[5] M. Jones, J. Bradley, and N. Sakimura, “JSON Web Token (JWT),” RFC 7519, May 2015. [Online]. Available: https://www.rfc-editor.org/rfc/rfc7519

[6] OpenStreetMap contributors, “OpenStreetMap.” [Online]. Available: https://www.openstreetmap.org

[7] F. Pedregosa *et al.*, “Scikit-learn: Machine learning in Python,” *Journal of Machine Learning Research*, vol. 12, pp. 2825–2830, 2011.

[8] T. Chen and C. Guestrin, “XGBoost: A scalable tree boosting system,” in *Proc. 22nd ACM SIGKDD Int. Conf. Knowledge Discovery and Data Mining*, San Francisco, CA, USA, 2016, pp. 785–794.

[9] People’s Republic of Bangladesh, *Road Transport Act, 2018*. The GPS notice reported in [2] also relies on the Road Transport Rules, 2022.

---

## Appendix

### A. Demonstration accounts

All seeded accounts use the practice password `Demo@12345`. They are not government credentials.

| Role | Email |
| --- | --- |
| Super administrator | admin@nirapad.gov.bd |
| Government | government@nirapad.gov.bd |
| BRTA | brta@nirapad.gov.bd |
| Police, Dhaka | police@nirapad.gov.bd |
| Additional police cities | police.ctg@, police.sylhet@, police.rajshahi@, and police.khulna@demo addresses in the sign-in page |
| Bus owner | owner.greenline@demo.bd |
| Driver | driver.rahim@demo.bd |
| Passenger | passenger.fatima@demo.bd |

### B. Suggested evaluation sequence

1. Show the banner that the system is a practice environment and that 999 is the real emergency number.
2. Sign in as the passenger, scan or open a demo bus, and create a complaint.
3. Sign in as the police user and show the same SOS or vehicle lookup.
4. Start the simulator and show a bus move, then an overspeed or off-route alert.
5. Open an administrator report download.
6. Switch the interface to Bangla on one page.
7. If asked about artificial intelligence, show the rule-based alert and state that the Python models are an experiment on synthetic data.

### C. Limits to state if an examiner asks

| Question | Answer supported by the project |
| --- | --- |
| Is this connected to BRTA? | No. |
| Are the buses real? | No. Names and movements are demo and simulated. |
| Does SOS call the police? | No. It is an in-application workflow. |
| What is the model accuracy? | Not claimed in this report. It would be read from the metrics file after a local training run. |
| Why did the live site fail earlier? | The API and database run on the development computer, and the temporary public link had stopped. |
