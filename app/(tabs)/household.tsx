import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
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
import { useHousehold } from "@/providers/household-provider";

export default function HouseholdScreen() {
  const theme = useAppTheme();
  const {
    data,
    activeMembers,
    archivedMembers,
    cloudError,
    cloudState,
    moveOutMember,
    refreshCloud,
  } = useHousehold();
  const current = data.members.find(
    (member) => member.id === data.currentUserId,
  )!;

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
                    onPress={() =>
                      Alert.alert(
                        `Move out ${member.name}?`,
                        "Their history remains intact and this action can be reversed by you.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Move out",
                            style: "destructive",
                            onPress: () => moveOutMember(member.id),
                          },
                        ],
                      )
                    }
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
        <Pressable onPress={() => router.push("/auth" as never)}>
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
    </AppScreen>
  );
}
