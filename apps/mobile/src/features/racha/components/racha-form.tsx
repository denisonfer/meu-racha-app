import { TRachaRules } from "@meu-racha/domain";
import { PropsWithChildren, RefObject } from "react";
import { Control } from "react-hook-form";
import { TextInput } from "react-native";
import { FormInput } from "@/ui/components";
import { TRachaForm } from "../racha-form-schema";
import { RachaFormScroll } from "./racha-form-scroll";
import { RulesSection } from "./rules-section";

export type TRachaFormProps = {
  control: Control<TRachaForm>;
  nameRef: RefObject<TextInput | null>;
  rules: TRachaRules;
  summary: string[];
  setRule: <K extends keyof TRachaRules>(key: K, value: TRachaRules[K]) => void;
  matchDurationError?: string;
  yellowOutError?: string;
  isRulesExpanded: boolean;
  toggleRules: () => void;
};

export const RachaForm = ({
  control,
  nameRef,
  rules,
  summary,
  setRule,
  matchDurationError,
  yellowOutError,
  isRulesExpanded,
  toggleRules,
  isDisabled,
  isRulesDisabled = false,
  rulesLockMessage,
  isNameAutoFocused = false,
  isRulesHintVisible = true,
  children,
}: TRachaFormProps &
  PropsWithChildren<{
    isDisabled: boolean;
    // o motor trava com evento rolando; o nome continua editável
    isRulesDisabled?: boolean;
    rulesLockMessage?: string | null;
    isNameAutoFocused?: boolean;
    isRulesHintVisible?: boolean;
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
    <RulesSection
      rules={rules}
      summary={summary}
      onChange={setRule}
      isExpanded={isRulesExpanded}
      onToggle={toggleRules}
      isDisabled={isDisabled || isRulesDisabled}
      matchDurationError={matchDurationError}
      yellowOutError={yellowOutError}
      isHintVisible={isRulesHintVisible}
      lockMessage={rulesLockMessage}
    />
    {children}
  </RachaFormScroll>
);
