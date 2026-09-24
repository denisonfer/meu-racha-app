import { Button, Input, Screen, Text } from "@/ui/components";
import { StyleSheet } from "react-native";

export const SignUpScreen = () => {
  return (
    <Screen title="Cadastro" isScrollable>
      <Text preset="h1">Hello World</Text>

      <Input
        label="Nome"
        placeholder="Digite seu nome"
        //value={name}
        //onChangeText={setName}
      />

      <Input
        label="Email"
        placeholder="Digite seu email"
        preset="email"
        //value={email}
        //onChangeText={setEmail}
      />

      <Input
        label="Senha"
        placeholder="Digite sua senha"
        preset="password"
        //value={password}
        //onChangeText={setPassword}
      />

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
