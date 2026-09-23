import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { Text, View, StyleSheet, Button } from "react-native";

export default function Index() {
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const signUp = async () => {
    const { data, error } = await supabase.auth.signUp({
      email: "test@test.com",
      password: "test123456",
      options: {
        data: {
          username: "denison2",
          display_name: "Denison",
          birth_date: "1991-01-01",
          plays_as: "OUTFIELD",
          primary_position: "DEFENDER",
          secondary_position: "MIDFIELDER",
        },
      },
    });

    setData(data);
    setError(error?.message ?? null);
  };

  return (
    <View style={styles.container}>
      <Text>Edit src/app/index.tsx to edit this screen.</Text>
      <Text>error: {error}</Text>
      <Text>data: {JSON.stringify(data)}</Text>
      <Button title="Cadastrar" onPress={signUp} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
