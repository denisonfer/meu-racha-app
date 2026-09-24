import { Button, Screen, Text } from "@/ui/components";
import { StyleSheet } from "react-native";

export const SignUpScreen = () => {
  return (
    <Screen title="Cadastro">
      <Text preset="h1">Hello World</Text>

      <Button
        title="Cadastrar"
        onPress={() => {
          console.log("Cadastrar");
        }}
      />
      <Button
        title="Cadastrar"
        preset="secondary"
        onPress={() => {
          console.log("Cadastrar");
        }}
      />
      <Button
        title="Cadastrar"
        preset="destructive"
        onPress={() => {
          console.log("Cadastrar");
        }}
      />
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
