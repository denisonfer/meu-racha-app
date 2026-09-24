import { Screen } from "@/ui/components";
import { StyleSheet, Text } from "react-native";

export const SignUpScreen = () => {
  return (
    <Screen title="Cadastro">
      <Text>Hello World</Text>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
