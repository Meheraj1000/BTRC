import "package:flutter/material.dart";
import "../api.dart";
import "../theme.dart";
import "../../main.dart";
import "passenger_home.dart";
import "driver_home.dart";
import "register_screen.dart";

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController(text: "passenger.fatima@demo.bd");
  final password = TextEditingController(text: "Demo@12345");
  String? error;
  bool busy = false;

  Future<void> submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final json = await Api.call("/auth/login", method: "POST", body: {
        "email": email.text.trim(),
        "password": password.text,
      });
      await persistSession(json["data"] as Map<String, dynamic>);
      final roles = List<String>.from(json["data"]["user"]["roles"] as List);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => roles.contains("DRIVER") ? const DriverHome() : const PassengerHome(),
      ));
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text("Nirapad Transit", style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: NirapadColors.secondary)),
            const SizedBox(height: 8),
            const Text("DEMO / SIMULATION — not a live government GPS feed."),
            const SizedBox(height: 24),
            TextField(controller: email, decoration: const InputDecoration(labelText: "Email")),
            TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: "Password")),
            if (error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(error!, style: const TextStyle(color: NirapadColors.error))),
            const SizedBox(height: 16),
            FilledButton(onPressed: busy ? null : submit, child: Text(busy ? "Signing in…" : "Sign in")),
            TextButton(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
              child: const Text("Passenger registration"),
            ),
            const SizedBox(height: 12),
            const Text("Demo password: Demo@12345\nPassenger: passenger.fatima@demo.bd\nDriver: driver.rahim@demo.bd", style: TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
