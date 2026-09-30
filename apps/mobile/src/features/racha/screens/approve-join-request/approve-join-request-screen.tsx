import { StyleSheet, View } from "react-native";
import { Avatar, BottomSheet, Button, Text } from "@/ui/components";
import { StarsAndSuperStarField } from "../../components/stars-and-super-star-field";
import { useApproveJoinRequestScreen } from "./use-approve-join-request-screen";

export const ApproveJoinRequestScreen = () => {
  const {
    person,
    isGoalkeeper,
    stars,
    setStars,
    isSuperStar,
    setIsSuperStar,
    canApprove,
    failureMessage,
    isApproving,
    confirm,
  } = useApproveJoinRequestScreen();

  if (!person) return null;

  return (
    <BottomSheet
      leading={
        <Avatar
          name={person.name}
          photoUrl={person.photoUrl}
          size={48}
          backgroundColor="background"
        />
      }
      title={person.title}
      supporting={
        <>
          <Text preset="small" style={styles.bold}>
            {person.summary}
          </Text>
          {person.belowMinAgeText ? (
            <Text preset="small" color="warning" style={styles.bold}>
              {person.belowMinAgeText}
            </Text>
          ) : null}
        </>
      }
      isBusy={isApproving}
    >
      <StarsAndSuperStarField
        isGoalkeeper={isGoalkeeper}
        stars={stars}
        onStarsChange={setStars}
        isSuperStar={isSuperStar}
        onSuperStarChange={setIsSuperStar}
        isDisabled={isApproving}
      />

      <View style={styles.footer}>
        <Text preset="small">Entra no racha como JOGADOR.</Text>
        {failureMessage ? (
          <Text preset="small" color="errorText" accessibilityRole="alert">
            {failureMessage}
          </Text>
        ) : null}
        <Button
          title="Aprovar"
          onPress={confirm}
          isDisabled={!canApprove}
          isLoading={isApproving}
          accessibilityLabel={isApproving ? "Aprovando" : "Aprovar"}
          accessibilityHint={
            canApprove ? undefined : "Escolha as Estrelas primeiro"
          }
          style={styles.approveButton}
        />
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  bold: { fontFamily: "Manrope-Bold" },
  footer: { gap: 10 },
  approveButton: { minHeight: 56 },
});
