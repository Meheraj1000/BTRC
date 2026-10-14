import "package:flutter/material.dart";
import "../api.dart";

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final name = TextEditingController();
  final email = TextEditingController();
  final phone = TextEditingController();
  final password = TextEditingController();
  String? msg;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Register")),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: "Full name")),
          TextField(controller: email, decoration: const InputDecoration(labelText: "Email")),
          TextField(controller: phone, decoration: const InputDecoration(labelText: "Phone")),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: "Password")),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              try {
                await Api.call("/auth/register", method: "POST", body: {
                  "fullName": name.text,
                  "email": email.text,
                  "phone": phone.text,
                  "password": password.text,
                });
                setState(() => msg = "Account created. Go back and sign in.");
              } catch (e) {
                setState(() => msg = e.toString());
              }
            },
            child: const Text("Create passenger account"),
          ),
          if (msg != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(msg!)),
        ],
      ),
    );
  }
}
