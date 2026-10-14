# Nirapad Transit mobile (Flutter)

Passenger and driver interfaces in one app. Role is chosen after login.

Flutter SDK is **not bundled**. On a machine with Flutter installed:

```bash
cd mobile
flutter create . --project-name nirapad_mobile --org bd.nirapad
flutter pub get
flutter run
```

`flutter create .` generates Android/iOS folders without overwriting `lib/`.

## API URL

Android emulator uses `10.0.2.2` to reach the host:

```bash
flutter run --dart-define=API_URL=http://10.0.2.2:4000/api
```

iOS simulator / desktop:

```bash
flutter run --dart-define=API_URL=http://localhost:4000/api
```

## Demo accounts

Password: `Demo@12345`

- Passenger: `passenger.fatima@demo.bd`
- Driver: `driver.rahim@demo.bd`

This app talks to the same REST API as the web client. GPS from the phone is labeled `DEVICE` and is rejected while `GPS_SOURCE_MODE=SIMULATION`.
