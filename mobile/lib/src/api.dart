import "dart:convert";
import "package:http/http.dart" as http;
import "package:shared_preferences/shared_preferences.dart";

class Api {
  static const base = String.fromEnvironment(
    "API_URL",
    defaultValue: "http://10.0.2.2:4000/api",
  );

  static Future<String?> token() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString("nt_access");
  }

  static Future<Map<String, dynamic>> call(
    String path, {
    String method = "GET",
    Map<String, dynamic>? body,
  }) async {
    final headers = {"Content-Type": "application/json"};
    final t = await token();
    if (t != null) headers["Authorization"] = "Bearer $t";
    final uri = Uri.parse("$base$path");
    late http.Response res;
    switch (method) {
      case "POST":
        res = await http.post(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      case "PUT":
        res = await http.put(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      case "PATCH":
        res = await http.patch(uri, headers: headers, body: jsonEncode(body ?? {}));
        break;
      default:
        res = await http.get(uri, headers: headers);
    }
    final json = jsonDecode(res.body) as Map<String, dynamic>;
    if (res.statusCode >= 400 || json["success"] != true) {
      throw Exception(json["message"] ?? "Request failed");
    }
    return json;
  }
}
