import "package:flutter_test/flutter_test.dart";
import "package:nirapad_mobile/main.dart";

void main() {
  testWidgets("app boots", (tester) async {
    await tester.pumpWidget(const NirapadApp());
    expect(find.byType(NirapadApp), findsOneWidget);
  });
}
