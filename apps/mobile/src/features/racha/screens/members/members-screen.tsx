import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Button, EmptyState, Screen, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { MemberRow } from "../../components/member-row";
import { useMembersScreen } from "./use-members-screen";

export const MembersScreen = () => {
  const {
    count,
    memberWord,
    showGroupTitles,
    groups,
    isOnlyOwner,
    isLoading,
    isError,
    retry,
    isRetrying,
    shareInvite,
  } = useMembersScreen();

  return (
    <Screen title="Membros" canGoBack isScrollable>
      {isLoading ? (
        <ActivityIndicator
          color={theme.colors.foreground}
          accessibilityLabel="Carregando membros"
        />
      ) : isError ? (
        <EmptyState
          title="Não deu pra abrir os membros"
          text="Confira a internet e tente de novo."
          actionLabel="Tentar de novo"
          onAction={retry}
          isLoading={isRetrying}
        />
      ) : (
        <View style={styles.content}>
          <View style={styles.countRow}>
            <Text style={styles.count}>{count}</Text>
            <Text preset="body" color="muted" style={styles.countWord}>
              {memberWord}
            </Text>
          </View>

          <View>
            {groups.map((group) => (
              <View key={group.key} style={styles.group}>
                {showGroupTitles ? (
                  <Text preset="small" color="muted" style={styles.groupTitle}>
                    {group.label} · {group.members.length}
                  </Text>
                ) : null}
                {group.members.map((member) => (
                  <MemberRow key={member.profileId} {...member} />
                ))}
              </View>
            ))}
          </View>

          {isOnlyOwner ? (
            <View style={styles.aloneCard}>
              <View style={styles.aloneTexts}>
                <Text preset="h3">Só você por enquanto</Text>
                <Text preset="small" color="muted">
                  Mande o convite. Quem pedir para entrar aparece em Pedidos.
                </Text>
              </View>
              <Button title="Compartilhar convite" onPress={shareInvite} />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { gap: 4 },
  countRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    paddingBottom: 8,
  },
  count: {
    ...theme.text.stat,
    fontSize: 32,
    lineHeight: 32,
    fontVariant: ["tabular-nums"],
  },
  countWord: { fontFamily: "Manrope-Bold" },
  group: { gap: 2 },
  groupTitle: {
    paddingTop: 16,
    paddingBottom: 6,
    fontFamily: "Manrope-Bold",
  },
  aloneCard: {
    marginTop: 20,
    gap: 12,
    padding: theme.space[16],
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
  },
  aloneTexts: { gap: 2 },
});
