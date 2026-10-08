import type { TMemberCard } from "@meu-racha/domain";
import { ScrollView, StyleSheet, View } from "react-native";
import { Icon, PlayerCard, Text } from "@/ui/components";
import { theme } from "@/ui/theme";
import { RoleChip } from "../../components/role-chip";
import { TRachaMember } from "../../racha-types";
import { starsLabel } from "../../utils/racha-labels";
import { memberCardProps } from "../../utils/member-card";

const CARD_WIDTH = 240;

type TMemberCardViewProps = {
  member: TRachaMember;
  card: TMemberCard | null;
  rachaName: string;
};

export const MemberCardView = ({
  member,
  card,
  rachaName,
}: TMemberCardViewProps) => (
  <ScrollView
    contentContainerStyle={styles.content}
    showsVerticalScrollIndicator={false}
  >
    <PlayerCard
      width={CARD_WIDTH}
      {...memberCardProps(member, member.isSuperStar, card, rachaName)}
    />
    {member.role !== "PLAYER" ? <RoleChip role={member.role} /> : null}
    {member.stars !== null ? (
      <View style={styles.stars}>
        <Text style={styles.starsText}>{starsLabel(member.stars)}</Text>
        <Icon name="star" size={18} color="action" fill="action" />
      </View>
    ) : null}
  </ScrollView>
);

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    gap: theme.space[16],
    paddingBottom: theme.space[24],
  },
  stars: { flexDirection: "row", alignItems: "center", gap: 6 },
  starsText: { fontFamily: "Manrope-Bold" },
});
