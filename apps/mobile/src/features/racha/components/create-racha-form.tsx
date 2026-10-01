import { DEFAULT_MIN_AGE, TRachaRules } from "@meu-racha/domain";
import { PropsWithChildren, RefObject } from "react";
import { Control } from "react-hook-form";
import { TextInput } from "react-native";
import { FormInput } from "@/ui/components";
import { TCreateRachaForm } from "../racha-form-schema";
import { OptionalNumberField } from "./optional-number-field";
import { RachaFormScroll } from "./racha-form-scroll";
import { RulesSection } from "./rules-section";

export type TCreateRachaFormProps = {
  control: Control<TCreateRachaForm>;
  nameRef: RefObject<TextInput | null>;
  placeRef: RefObject<TextInput | null>;
  minAge: number | null;
  setMinAge: (value: number | null) => void;
  minAgeError?: string;
  rules: TRachaRules;
  summary: string[];
  setRule: <K extends keyof TRachaRules>(key: K, value: TRachaRules[K]) => void;
  matchDurationError?: string;
  isRulesExpanded: boolean;
  toggleRules: () => void;
};

export const CreateRachaForm = ({
  control,
  nameRef,
  placeRef,
  minAge,
  setMinAge,
  minAgeError,
  minAgeRestoreValue = DEFAULT_MIN_AGE,
  rules,
  summary,
  setRule,
  matchDurationError,
  isRulesExpanded,
  toggleRules,
  isDisabled,
  isNameAutoFocused = false,
  isRulesHintVisible = true,
  children,
}: TCreateRachaFormProps &
  PropsWithChildren<{
    isDisabled: boolean;
    isNameAutoFocused?: boolean;
    isRulesHintVisible?: boolean;
    minAgeRestoreValue?: number;
  }>) => (
  <RachaFormScroll>
    <FormInput
      ref={nameRef}
      control={control}
      name="name"
      label="Nome do racha"
      placeholder="Ex.: Racha da Quadra do Zé"
      hint="Aparece no convite que você manda para a galera."
      autoFocus={isNameAutoFocused}
      maxLength={40}
      isDisabled={isDisabled}
    />
    <FormInput
      ref={placeRef}
      control={control}
      name="place"
      label="Local"
      maxLength={120}
      isDisabled={isDisabled}
    />
    <OptionalNumberField
      label="Idade mínima"
      value={minAge}
      onChange={setMinAge}
      unit="anos"
      noneLabel="Sem idade mínima"
      restoreValue={minAgeRestoreValue}
      hint="Não barra ninguém: aparece no convite e destaca, no pedido, quem tem menos que isso."
      error={minAgeError}
      isDisabled={isDisabled}
      accessibilityLabel="Idade mínima, em anos"
    />
    <RulesSection
      rules={rules}
      summary={summary}
      onChange={setRule}
      isExpanded={isRulesExpanded}
      onToggle={toggleRules}
      isDisabled={isDisabled}
      matchDurationError={matchDurationError}
      isHintVisible={isRulesHintVisible}
    />
    {children}
  </RachaFormScroll>
);
