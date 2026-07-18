import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";

import { AppScreen, useAppTheme } from "@/components/app-screen";
import { BrandLockup, BrandMark } from "@/components/brand-mark";
import {
  Avatar,
  Card,
  EditorialHeader,
  Pill,
  PrimaryButton,
  SectionTitle,
  StatChip,
} from "@/components/homiez-ui";
import {
  ScreenIllustration,
  screenIllustrations,
} from "@/components/screen-illustration";
import { typography } from "@/constants/design";
import { getMemberBalanceSummary } from "@/lib/ledger";
import { formatMoney } from "@/lib/money";
import { useHousehold } from "@/providers/household-provider";

export default function HouseholdScreen() {
  const theme = useAppTheme();
  const {
    data,
    activeMembers,
    archivedMembers,
    cloudError,
    cloudState,
    deleteHousehold,
    deleteHouseholdBlockReason,
    leaveHousehold,
    moveOutMember,
    moveOutBlockReason,
    refreshCloud,
    settleAllReceivables,
  } = useHousehold();
  const [householdAction, setHouseholdAction] = useState<"leave" | "delete" | "settle">();
  const current = data.members.find(
    (member) => member.id === data.currentUserId,
  )!;
  const currentMoveOutBlock = moveOutBlockReason(data.currentUserId);
  const isSoleActiveMember = activeMembers.length === 1;
  const currentBalance = getMemberBalanceSummary(data.peerBalances, data.currentUserId);
  const currency = data.currency ?? "INR";

  async function runHouseholdAction(action: "leave" | "delete", settleReceivables = false) {
    setHouseholdAction(action);
    try {
      if (action === "delete") await deleteHousehold();
      else await leaveHousehold({ settleReceivables });
    } catch (error) {
      Alert.alert(
        action === "delete" ? "Could not delete household" : "Could not leave household",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setHouseholdAction(undefined);
    }
  }

  async function settleEverythingOwedToMe() {
    setHouseholdAction("settle");
    try {
      await settleAllReceivables();
    } catch (error) {
      Alert.alert("Could not settle balances", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setHouseholdAction(undefined);
    }
  }

  if (cloudState !== "demo" && cloudState !== "synced") {
    const signIn = cloudState === "signed-out";
    const setup = cloudState === "needs-household";
    return (
      <AppScreen contentContainerStyle={{ paddingBottom: 42 }}>
        <ScreenIllustration source={screenIllustrations.household} artworkOnly />
        <Card accent={theme.accent} variant="elevated">
          <EditorialHeader
            eyebrow="The people layer"
            title="Household"
            description="Secure shared data begins with a real account and one flat."
          />
          <View style={{ height: 1, backgroundColor: theme.border }} />
          <BrandMark />
          <Text
            selectable
            style={{
              color: theme.heading,
              fontFamily: typography.semibold,
              fontSize: 26,
            }}
          >
            {cloudState === "loading"
              ? "Finding your front door…"
              : signIn
                ? "Bring your flat online."
                : setup
                  ? "Name the place you share."
                  : "The connection went quiet."}
          </Text>
          <Text selectable style={{ color: theme.muted, lineHeight: 19 }}>
            {cloudError ??
              "Your on-device demo remains safe while this connection is resolved."}
          </Text>
          {signIn ? (
            <PrimaryButton
              label="Open account"
              onPress={() => router.push("/auth" as never)}
            />
          ) : null}
          {setup ? (
            <PrimaryButton
              label="Create or join a household"
              onPress={() => router.push("/household-setup" as never)}
            />
          ) : null}
          {cloudState === "error" ? (
            <PrimaryButton
              label="Try again"
              onPress={() => void refreshCloud()}
            />
          ) : null}
        </Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={{ paddingBottom: 42 }}>
      <ScreenIllustration source={screenIllustrations.household} artworkOnly />
      <Card accent={theme.accent} variant="elevated">
        <EditorialHeader
          eyebrow="The people layer"
          title="Household"
          description="Flat hierarchy by design. Everyone gets the same keys and the same truth."
        />
        <View style={{ height: 1, backgroundColor: theme.border }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <BrandLockup compact />
          <Pill tone={cloudState === "synced" ? "positive" : "neutral"}>
            {cloudState === "synced" ? "LIVE HOUSEHOLD" : "DEMO HOUSEHOLD"}
          </Pill>
        </View>
        <Text
          selectable
          style={{
            color: theme.heading,
            fontFamily: typography.semibold,
            fontSize: 20,
          }}
        >
          {data.name}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 18,
            backgroundColor: theme.background,
            boxShadow: "inset 4px 4px 10px rgba(0,0,0,.3)",
          }}
        >
          <Text
            selectable
            style={{
              color: theme.heading,
              flex: 1,
              fontFamily: typography.bold,
              fontSize: 21,
              letterSpacing: 2.5,
            }}
          >
            {data.joinCode}
          </Text>
          <MaterialIcons name="share" size={20} color={theme.accent} />
        </View>
        <Text selectable style={{ color: theme.muted, fontSize: 11 }}>
          homiez://join/{data.joinCode}
        </Text>
      </Card>
      <View style={{ flexDirection: "row", gap: 9 }}>
        <StatChip
          label="Who is home"
          value={`${activeMembers.length} active`}
        />
        <StatChip
          label="Archive"
          value={`${archivedMembers.length}`}
          accent={theme.accent}
        />
      </View>
      <View style={{ gap: 12 }}>
        <SectionTitle
          title="Equal keys, individual stories"
          action="Archive"
          onPress={() => router.push("/archived-roommates" as never)}
        />
        {activeMembers.map((member) => {
          const isCurrent = member.id === data.currentUserId;
          const blockReason = moveOutBlockReason(member.id);
          return (
            <Card key={member.id} style={{ padding: 14 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <Avatar name={member.name} active />
                <View style={{ flex: 1 }}>
                  <Text
                    selectable
                    style={{
                      color: theme.heading,
                      fontFamily: typography.semibold,
                      fontSize: 14,
                    }}
                  >
                    {member.name}
                  </Text>
                  <Text
                    selectable
                    style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}
                  >
                    {member.email}
                  </Text>
                </View>
                {isCurrent ? (
                  <Pill tone="positive">YOU</Pill>
                ) : (
                  <Pressable
                    onPress={() => {
                      if (blockReason) {
                        Alert.alert("Cannot move out yet", blockReason);
                        return;
                      }
                      Alert.alert(
                        `Move out ${member.name}?`,
                        "Their history remains intact and this action can be reversed by you.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Move out",
                            style: "destructive",
                            onPress: () => void moveOutMember(member.id).catch((error: unknown) =>
                              Alert.alert("Could not move out roommate", error instanceof Error ? error.message : "Please try again."),
                            ),
                          },
                        ],
                      );
                    }}
                  >
                    <Text
                      style={{
                        color: theme.accent,
                        fontFamily: typography.bold,
                        fontSize: 10,
                      }}
                    >
                      MOVE OUT
                    </Text>
                  </Pressable>
                )}
              </View>
            </Card>
          );
        })}
      </View>
      <View style={{ gap: 12 }}>
        <SectionTitle title="Your corner" />
        <Pressable onPress={() => router.push("/account" as never)}>
          <Card>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <Avatar name={current.name} active />
              <View style={{ flex: 1 }}>
                <Text
                  selectable
                  style={{
                    color: theme.heading,
                    fontFamily: typography.semibold,
                    fontSize: 14,
                  }}
                >
                  Account & connection
                </Text>
                <Text
                  selectable
                  style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}
                >
                  Email identity · secure cloud session
                </Text>
              </View>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: theme.cardStrong,
                }}
              >
                <MaterialIcons
                  name="north-east"
                  color={theme.heading}
                  size={18}
                />
              </View>
            </View>
          </Card>
        </Pressable>
      </View>
      <View style={{ gap: 12 }}>
        <SectionTitle title="Household actions" />
        <Card accent={isSoleActiveMember ? theme.accent : undefined}>
          <Text selectable style={{ color: theme.heading, fontFamily: typography.semibold, fontSize: 16 }}>
            {isSoleActiveMember ? "Close this household" : "Leave this household"}
          </Text>
          <Text selectable style={{ color: theme.muted, fontSize: 12, lineHeight: 18 }}>
            {isSoleActiveMember
              ? deleteHouseholdBlockReason ?? "You are the only active member. Deleting removes this household and lets you create or join another one."
              : currentBalance.owingCents > 0
                ? `You must first settle ${formatMoney(currentBalance.owingCents, currency)} that you owe. Money owed to you can be cleared separately.`
                : currentBalance.owedCents > 0
                  ? `${formatMoney(currentBalance.owedCents, currency)} is owed to you. You can mark all of it settled and leave in one action.`
                  : currentMoveOutBlock ?? "Your history stays with the household, and you can create or join another household after leaving."}
          </Text>
          {currentBalance.owedCents > 0 ? (
            <PrimaryButton
              label={householdAction === "settle" ? "Settling…" : "Settle all owed to me"}
              tone="dark"
              icon="done-all"
              disabled={Boolean(householdAction)}
              onPress={() => Alert.alert(
                "Settle everything owed to you?",
                "This immediately clears all of your receivables without debtor approval. Continue only after payment or if you choose to forgive them.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Settle all", style: "destructive", onPress: () => void settleEverythingOwedToMe() },
                ],
              )}
            />
          ) : null}
          <PrimaryButton
            label={householdAction
              ? "Working…"
              : isSoleActiveMember
                ? "Delete household"
                : currentBalance.owedCents > 0 && currentBalance.owingCents === 0
                  ? "Settle all & leave"
                  : "Leave household"}
            tone="dark"
            icon={isSoleActiveMember ? "delete-outline" : "logout"}
            disabled={Boolean(householdAction) || (isSoleActiveMember ? Boolean(deleteHouseholdBlockReason) : currentBalance.owingCents > 0)}
            onPress={() => Alert.alert(
              isSoleActiveMember ? "Delete this household?" : "Leave this household?",
              isSoleActiveMember
                ? "This permanently removes its ledger, chores, and membership history. This cannot be undone."
                : currentBalance.owedCents > 0
                  ? "Everything owed to you will be marked settled, then you will leave. This cannot be reversed from the ledger."
                  : "You will lose active access, but the shared history will remain for your roommates.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: isSoleActiveMember ? "Delete" : "Leave",
                  style: "destructive",
                  onPress: () => void runHouseholdAction(isSoleActiveMember ? "delete" : "leave", !isSoleActiveMember && currentBalance.owedCents > 0),
                },
              ],
            )}
          />
        </Card>
      </View>
    </AppScreen>
  );
}
