import "package:flutter/material.dart";
import "package:shared_preferences/shared_preferences.dart";
import "src/api.dart";
import "src/theme.dart";
import "src/screens/login_screen.dart";
import "src/screens/passenger_home.dart";
import "src/screens/driver_home.dart";

void main() {
  runApp(const NirapadApp());
}

class NirapadApp extends StatelessWidget {
  const NirapadApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Nirapad Transit",
      theme: nirapadTheme(),
      home: const Gate(),
    );
  }
}

class Gate extends StatefulWidget {
  const Gate({super.key});
  @override
  State<Gate> createState() => _GateState();
}

class _GateState extends State<Gate> {
  Widget? child;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    try {
      final json = await Api.call("/auth/me");
      final roles = List<String>.from((json["data"]["roles"] as List?) ?? []);
      if (!mounted) return;
      setState(() {
        child = roles.contains("DRIVER")
            ? const DriverHome()
            : const PassengerHome();
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => child = const LoginScreen());
    }
  }

  @override
  Widget build(BuildContext context) {
    return child ?? const Scaffold(body: Center(child: CircularProgressIndicator()));
  }
}

Future<void> persistSession(Map<String, dynamic> data) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString("nt_access", data["accessToken"] as String);
  await prefs.setString("nt_refresh", data["refreshToken"] as String);
}

Future<void> clearSession() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.clear();
}
