import "package:flutter/material.dart";
import "package:flutter_map/flutter_map.dart";
import "package:geolocator/geolocator.dart";
import "package:latlong2/latlong.dart";
import "../api.dart";
import "../theme.dart";
import "../../main.dart";
import "login_screen.dart";

class PassengerHome extends StatefulWidget {
  const PassengerHome({super.key});
  @override
  State<PassengerHome> createState() => _PassengerHomeState();
}

class _PassengerHomeState extends State<PassengerHome> {
  int tab = 0;
  List routes = [];
  List buses = [];
  List complaints = [];
  List notes = [];
  List sosItems = [];
  String query = "";
  String? status;
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
      final r = await Api.call(query.isEmpty ? "/routes?page=1&pageSize=20" : "/routes?page=1&pageSize=20&q=${Uri.encodeQueryComponent(query)}");
      final b = await Api.call("/gps/live");
      final c = await Api.call("/complaints");
      final n = await Api.call("/notifications");
      List sosRows = [];
      try {
        final s = await Api.call("/sos?page=1&pageSize=10");
        final sosData = s["data"];
        sosRows = sosData is List ? sosData : (sosData["items"] as List? ?? []);
      } catch (_) {}
      setState(() {
        final data = r["data"];
        routes = data is List ? data : (data["items"] as List? ?? []);
        buses = (b["data"]["items"] as List?) ?? [];
        complaints = (c["data"] as List?) ?? [];
        notes = (n["data"] as List?) ?? [];
        sosItems = sosRows;
      });
    } catch (e) {
      setState(() => status = e.toString());
    }
  }

  Future<void> sos() async {
    setState(() => sosBusy = true);
    try {
      final body = <String, dynamic>{
        "message": "Mobile passenger SOS (application workflow, not a real dispatch)",
        "category": "SAFETY",
        "idempotencyKey": sosKey ??= _uuid(),
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
        status = "SOS ${data["existing"] == true ? "already active" : "recorded"} · ${data["status"]} · $loc. Not a live emergency service.";
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

  Future<void> complaint() async {
    await Api.call("/complaints", method: "POST", body: {
      "category": "OTHER",
      "description": "Passenger report from the Flutter app.",
    });
    setState(() => status = "Complaint submitted.");
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final pages = [_home(), _map(), _routes(), _safety()];
    return Scaffold(
      appBar: AppBar(
        title: const Text("Passenger"),
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
      body: pages[tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: "Home"),
          NavigationDestination(icon: Icon(Icons.map), label: "Map"),
          NavigationDestination(icon: Icon(Icons.alt_route), label: "Routes"),
          NavigationDestination(icon: Icon(Icons.emergency), label: "Safety"),
        ],
      ),
    );
  }

  Widget _home() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Card(
          color: NirapadColors.warningBg,
          child: ListTile(
            title: Text("Demo / simulated GPS"),
            subtitle: Text("Not a government, BRTA, or emergency dispatch app."),
          ),
        ),
        Text("Live buses: ${buses.length}"),
        const SizedBox(height: 8),
        ...buses.take(8).map((b) => ListTile(
          title: Text("${b["registrationNo"] ?? b["busId"]}"),
          subtitle: Text("${b["routeName"] ?? "Route unknown"} · ${b["trackingState"] ?? "ONLINE"} · ${b["speed"]} km/h"),
        )),
        if (status != null) Text(status!),
      ],
    );
  }

  Widget _map() {
    final markers = buses.where((b) => b["latitude"] != null && b["longitude"] != null).map((b) {
      return Marker(
        point: LatLng((b["latitude"] as num).toDouble(), (b["longitude"] as num).toDouble()),
        width: 36,
        height: 36,
        child: const Icon(Icons.directions_bus, color: NirapadColors.primary),
      );
    }).toList();
    return FlutterMap(
      options: const MapOptions(initialCenter: LatLng(23.8103, 90.4125), initialZoom: 11),
      children: [
        TileLayer(urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", userAgentPackageName: "nirapad.mobile"),
        MarkerLayer(markers: markers),
      ],
    );
  }

  Widget _routes() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: const InputDecoration(hintText: "Search name, code, stop"),
            onSubmitted: (v) {
              query = v;
              _load();
            },
          ),
        ),
        Expanded(
          child: ListView(
            children: routes.map((r) {
              return ListTile(
                title: Text("${r["code"]}  ${r["name"]}"),
                subtitle: Text("${r["startName"]} → ${r["endName"]}"),
                onTap: () async {
                  final detail = await Api.call("/routes/${r["id"]}");
                  if (!mounted) return;
                  final stops = (detail["data"]["stops"] as List?) ?? [];
                  showModalBottomSheet(
                    context: context,
                    builder: (_) => ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        Text("${detail["data"]["name"]}", style: Theme.of(context).textTheme.titleLarge),
                        Text("${detail["data"]["startName"]} → ${detail["data"]["endName"]}"),
                        const SizedBox(height: 8),
                        ...stops.map((s) => ListTile(dense: true, title: Text("${s["sequence"]}. ${s["name"]}"))),
                      ],
                    ),
                  );
                },
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _safety() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        FilledButton.tonal(onPressed: complaint, child: const Text("Submit complaint")),
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
          subtitle: Text("${s["createdAt"]} · ${s["locationAvailable"] == true ? "Location captured" : "Location unavailable"}"),
          trailing: s["status"] == "OPEN"
              ? TextButton(onPressed: () => cancelSos("${s["id"]}"), child: const Text("Cancel"))
              : null,
        )),
        const SizedBox(height: 16),
        Text("Your complaints", style: Theme.of(context).textTheme.titleMedium),
        ...complaints.take(8).map((c) => ListTile(
          title: Text("${c["category"]}"),
          subtitle: Text("${c["status"]} · ${c["description"]}"),
        )),
        const SizedBox(height: 8),
        Text("Notifications", style: Theme.of(context).textTheme.titleMedium),
        ...notes.take(8).map((n) => ListTile(
          title: Text("${n["title"]}"),
          subtitle: Text("${n["body"]}"),
        )),
      ],
    );
  }
}
