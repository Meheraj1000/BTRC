import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "../api.dart";
import "../theme.dart";
import "../../main.dart";
import "login_screen.dart";

class DriverHome extends StatefulWidget {
  const DriverHome({super.key});
  @override
  State<DriverHome> createState() => _DriverHomeState();
}

class _DriverHomeState extends State<DriverHome> {
  String? status;
  List trips = [];
  List sosItems = [];
  bool sosConfirm = false;
  bool sosBusy = false;
  String? sosKey;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final t = await Api.call("/trips");
      List sosRows = [];
      try {
        final s = await Api.call("/sos?page=1&pageSize=10");
        final sosData = s["data"];
        sosRows = sosData is List ? sosData : (sosData["items"] as List? ?? []);
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        trips = t["data"] is List ? t["data"] as List : [];
        sosItems = sosRows;
      });
    } catch (_) {}
  }

  Future<void> startTrip() async {
    final j = await Api.call("/trips/start", method: "POST", body: {});
    setState(() => status = "Trip started: ${j["data"]["id"]}");
  }

  Future<void> endTrip() async {
    await Api.call("/trips/end", method: "POST", body: {});
    setState(() => status = "Trip ended.");
  }

  Future<void> shareGps() async {
    final permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) {
      setState(() => status = "Location permission denied. Simulator can still feed GPS.");
      return;
    }
    final pos = await Geolocator.getCurrentPosition();
    final me = await Api.call("/auth/me");
    final buses = await Api.call("/buses");
    final items = (buses["data"]["items"] as List?) ?? [];
    if (items.isEmpty) {
      setState(() => status = "No assigned bus found.");
      return;
    }
    await Api.call("/gps/location", method: "POST", body: {
      "busId": items.first["id"],
      "latitude": pos.latitude,
      "longitude": pos.longitude,
      "speed": (pos.speed * 3.6).clamp(0, 120),
      "heading": pos.heading.clamp(0, 360),
      "source": "DEVICE",
    });
    setState(() => status = "Posted DEVICE location for ${me["data"]["fullName"]}.");
  }

  Future<void> sos() async {
    setState(() => sosBusy = true);
    try {
      sosKey ??= _uuid();
      final body = <String, dynamic>{
        "message": "Driver mobile SOS (application workflow, not a real dispatch)",
        "category": "SAFETY",
        "idempotencyKey": sosKey,
      };
      try {
        final pos = await Geolocator.getCurrentPosition();
        body["latitude"] = pos.latitude;
        body["longitude"] = pos.longitude;
      } catch (_) {}
      final json = await Api.call("/sos", method: "POST", body: body);
      final data = json["data"] as Map<String, dynamic>;
      final loc = data["locationAvailable"] == true
          ? "Location captured (${data["locationSource"]})"
          : "Location unavailable";
      setState(() {
        status =
            "SOS ${data["existing"] == true ? "already active" : "recorded"} · ${data["status"]} · $loc. Not a live dispatch.";
        sosConfirm = false;
        if (data["existing"] != true) sosKey = null;
      });
      await _load();
    } catch (e) {
      setState(() => status = e.toString());
    } finally {
      if (mounted) setState(() => sosBusy = false);
    }
  }

  String _uuid() {
    final ms = DateTime.now().microsecondsSinceEpoch.toRadixString(16).padLeft(12, "0");
    return "00000000-0000-4000-8000-${ms.substring(ms.length - 12)}";
  }

  Future<void> cancelSos(String id) async {
    await Api.call("/sos/$id/cancel", method: "POST", body: {});
    setState(() {
      status = "SOS cancelled in the application.";
      sosKey = null;
    });
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Driver"),
        actions: [
          IconButton(
            onPressed: () async {
              await clearSession();
              if (!context.mounted) return;
              Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Card(
            color: NirapadColors.warningBg,
            child: ListTile(
              title: Text("Simulation-aware driver app"),
              subtitle: Text("DEVICE posts are rejected unless GPS_SOURCE_MODE=DEVICE. SOS is application-only."),
            ),
          ),
          FilledButton(onPressed: startTrip, child: const Text("Start trip")),
          const SizedBox(height: 8),
          FilledButton.tonal(onPressed: endTrip, child: const Text("End trip")),
          const SizedBox(height: 8),
          FilledButton.tonal(onPressed: shareGps, child: const Text("Share current GPS")),
          const SizedBox(height: 8),
          const Text("Application SOS only. This does not call 999, police, or ambulance."),
          const SizedBox(height: 8),
          if (!sosConfirm)
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: NirapadColors.error),
              onPressed: () => setState(() => sosConfirm = true),
              child: const Text("Trigger SOS"),
            )
          else
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: NirapadColors.error),
              onPressed: sosBusy ? null : sos,
              child: Text(sosBusy ? "Recording…" : "Confirm SOS (demo workflow)"),
            ),
          if (status != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(status!)),
          const SizedBox(height: 12),
          Text("Your SOS", style: Theme.of(context).textTheme.titleMedium),
          ...sosItems.take(8).map((s) => ListTile(
                title: Text("${s["status"]}"),
                subtitle: Text(
                    "${s["createdAt"]} · ${s["locationAvailable"] == true ? "Location captured" : "Location unavailable"}"),
                trailing: s["status"] == "OPEN"
                    ? TextButton(onPressed: () => cancelSos("${s["id"]}"), child: const Text("Cancel"))
                    : null,
              )),
          const Divider(),
          const Text("Trip history", style: TextStyle(fontWeight: FontWeight.bold)),
          ...trips.take(10).map((t) => ListTile(title: Text("${t["status"]}"), subtitle: Text("${t["startedAt"]}"))),
        ],
      ),
    );
  }
}
