import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";
import { TERMS, type TTerm } from "../../utils/racha-messages";

const isTerm = (value: string | undefined): value is TTerm =>
  value !== undefined && Object.keys(TERMS).includes(value);

export function useTermScreen() {
  const { term } = useLocalSearchParams<{ term: string }>();
  const navigation = useNavigation();
  const entry = isTerm(term) ? TERMS[term] : null;

  // link velho ou digitado à mão: sem termo, não há folha
  useEffect(() => {
    if (!entry && navigation.isFocused()) router.back();
  }, [entry, navigation]);

  return entry;
}
