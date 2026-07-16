import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { AppScreen, useAppTheme } from "@/components/app-screen";
import {
  Avatar,
  Callout,
  Card,
  EditorialHeader,
  Pill,
  PrimaryButton,
  SectionTitle,
  Segmented,
  SelectField,
} from "@/components/homiez-ui";
import { typography } from "@/constants/design";
import { formatMoney, moneyToCents } from "@/lib/money";
import type { CurrencyCode, ExpenseSplit } from "@/lib/types";
import { useHousehold } from "@/providers/household-provider";

type AllocationUnit = "amount" | "percent";
const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: "INR", label: "INR · Indian Rupee" },
  { value: "USD", label: "USD · US Dollar" },
  { value: "EUR", label: "EUR · Euro" },
  { value: "GBP", label: "GBP · British Pound" },
  { value: "AUD", label: "AUD · Australian Dollar" },
  { value: "CAD", label: "CAD · Canadian Dollar" },
];
function equalSplits(amount: number, ids: string[]): ExpenseSplit[] {
  if (!ids.length) return [];
  const base = Math.floor(amount / ids.length);
  const extra = amount - base * ids.length;
  return ids.map((memberId, index) => ({
    memberId,
    owedCents: base + (index < extra ? 1 : 0),
  }));
}

export default function AddExpenseScreen() {
  const theme = useAppTheme();
  const { activeMembers, data, addExpense } = useHousehold();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(data.currency ?? "INR");
  const [paidBy, setPaidBy] = useState(data.currentUserId);
  const [method, setMethod] = useState<"equal" | "custom">("equal");
  const [selected, setSelected] = useState(
    activeMembers.map((member) => member.id),
  );
  const [unit, setUnit] = useState<AllocationUnit>("amount");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const cents = moneyToCents(amount);
  const currencySymbol = new Intl.NumberFormat("en-US", { style: "currency", currency })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value ?? currency;
  const splits = useMemo(() => {
    if (method === "equal") return equalSplits(cents, selected);
    if (unit === "percent")
      return selected.map((memberId, index) => {
        const before = selected
          .slice(0, index)
          .reduce(
            (sum, id) =>
              sum + Math.round((cents * Number(custom[id] ?? 0)) / 100),
            0,
          );
        return {
          memberId,
          owedCents:
            index === selected.length - 1
              ? cents - before
              : Math.round((cents * Number(custom[memberId] ?? 0)) / 100),
        };
      });
    return selected.map((memberId) => ({
      memberId,
      owedCents: moneyToCents(custom[memberId] ?? ""),
    }));
  }, [cents, custom, method, selected, unit]);
  const allocated = splits.reduce((sum, split) => sum + split.owedCents, 0);
  const percent = selected.reduce(
    (sum, id) => sum + Number(custom[id] ?? 0),
    0,
  );
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.length === 1
          ? current
          : current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  function save() {
    if (!description.trim() || cents <= 0)
      return Alert.alert("Add a description and a valid amount.");
    if (
      method === "custom" &&
      unit === "percent" &&
      Math.abs(percent - 100) > 0.001
    )
      return Alert.alert("Custom percentages need to add up to 100%.");
    if (allocated !== cents)
      return Alert.alert(
        "Custom amounts need to add up exactly to the expense total.",
      );
    addExpense({
      description,
      amountCents: cents,
      paidBy,
      splitMethod: method,
      splits,
      currency,
    });
    router.back();
  }
  const field = {
    backgroundColor: theme.card,
    color: theme.heading,
    borderRadius: 19,
    paddingHorizontal: 16,
    minHeight: 58,
    fontFamily: typography.medium,
    fontSize: 15,
    boxShadow:
      "inset 4px 4px 11px rgba(0,0,0,.27), inset -3px -3px 9px rgba(255,255,255,.018)",
  } as const;

  return (
    <AppScreen keyboardShouldPersistTaps="handled">
      <EditorialHeader
        eyebrow="New ledger entry"
        title="Log the facts"
        description="The split becomes visible to everyone—down to the cent."
      />
      <View style={{ gap: 8 }}>
        <Text
          selectable
          style={{
            color: theme.muted,
            fontFamily: typography.semibold,
            fontSize: 11,
          }}
        >
          WHAT WAS IT?
        </Text>
        <TextInput
          accessibilityLabel="Expense description"
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. Sunday groceries"
          placeholderTextColor={theme.faint}
          style={field}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Text
          selectable
          style={{
            color: theme.muted,
            fontFamily: typography.semibold,
            fontSize: 11,
          }}
        >
          TOTAL AMOUNT
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 82,
            paddingHorizontal: 18,
            borderRadius: 24,
            backgroundColor: theme.cardStrong,
            boxShadow:
              "inset 5px 5px 13px rgba(0,0,0,.24), 0 14px 30px rgba(0,0,0,.2)",
          }}
        >
          <Text style={{ color: theme.muted, fontSize: 28 }}>{currencySymbol}</Text>
          <TextInput
            accessibilityLabel="Amount"
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={theme.faint}
            keyboardType="decimal-pad"
            style={{
              flex: 1,
              height: "100%",
              paddingHorizontal: 10,
              color: theme.heading,
              fontFamily: typography.extraBold,
              fontSize: 42,
              letterSpacing: -1.6,
              fontVariant: ["tabular-nums"],
            }}
          />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <SectionTitle title="Currency" action={data.currency ? "House default" : "Sets house default"} />
        <SelectField
          accessibilityLabel="Expense currency"
          options={CURRENCIES}
          value={currency}
          onChange={(value) => setCurrency(value as CurrencyCode)}
        />
        <Text selectable style={{ color: theme.muted, fontSize: 11, lineHeight: 17 }}>
          {data.currency ? `${data.currency} is preselected for the house, but you can change it for this expense.` : `${currency} will become the default after the first expense is saved.`}
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Who paid?" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
          {activeMembers.map((member) => {
            const chosen = member.id === paidBy;
            return (
              <Pressable
                key={member.id}
                onPress={() => setPaidBy(member.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  padding: 10,
                  borderRadius: 17,
                  backgroundColor: chosen ? theme.cardStrong : theme.card,
                  boxShadow: chosen
                    ? "inset 0 0 0 1px rgba(255,64,0,.24)"
                    : undefined,
                }}
              >
                <Avatar name={member.name} active={chosen} />
                <Text
                  style={{
                    color: theme.heading,
                    fontFamily: typography.semibold,
                    fontSize: 14,
                  }}
                >
                  {member.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <SectionTitle title="How should it split?" />
        <Segmented
          value={method}
          onChange={(value) => setMethod(value as "equal" | "custom")}
          options={[
            { value: "equal", label: "Equal" },
            { value: "custom", label: "Custom" },
          ]}
        />
        <Text selectable style={{ color: theme.muted, fontSize: 11 }}>
          {method === "equal"
            ? "The amount is divided evenly, down to the cent."
            : "Choose exact amounts or percentages."}
        </Text>
      </View>
      {method === "custom" ? (
        <Segmented
          value={unit}
          onChange={(value) => setUnit(value as AllocationUnit)}
          options={[
            { value: "amount", label: "Currency amounts" },
            { value: "percent", label: "Percentages" },
          ]}
        />
      ) : null}
      <View style={{ gap: 10 }}>
        <SectionTitle
          title="Split with"
          action={`${selected.length} selected`}
        />
        {activeMembers.map((member) => {
          const chosen = selected.includes(member.id);
          const split = splits.find((item) => item.memberId === member.id);
          return (
            <Pressable key={member.id} onPress={() => toggle(member.id)}>
              <Card
                variant={chosen ? "elevated" : "default"}
                style={{
                  padding: 12,
                  boxShadow: chosen
                    ? "inset 0 0 0 1px rgba(255,64,0,.24), 0 8px 18px rgba(0,0,0,.18)"
                    : undefined,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 11,
                  }}
                >
                  <Avatar name={member.name} />
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
                      {chosen ? "Included" : "Not included"}
                    </Text>
                  </View>
                  {method === "equal" && chosen ? (
                    <Pill tone="subtle">
                      {formatMoney(split?.owedCents ?? 0, currency)}
                    </Pill>
                  ) : null}
                  {method === "custom" && chosen ? (
                    <TextInput
                      value={custom[member.id] ?? ""}
                      onChangeText={(value) =>
                        setCustom((current) => ({
                          ...current,
                          [member.id]: value,
                        }))
                      }
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={theme.faint}
                      onPressIn={(event) => event.stopPropagation()}
                      style={{
                        width: 74,
                        minHeight: 40,
                        borderRadius: 12,
                        backgroundColor: theme.background,
                        color: theme.heading,
                        paddingHorizontal: 8,
                        textAlign: "right",
                        fontFamily: typography.bold,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: `inset 0 0 0 2px ${chosen ? theme.accent : theme.faint}`,
                    }}
                  >
                    {chosen ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: theme.accent,
                        }}
                      />
                    ) : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
      <Callout title={`${formatMoney(allocated, currency)} assigned`}>
        {selected.length} roommates ·{" "}
        {method === "equal" && selected.length
          ? `${formatMoney(Math.floor(cents / selected.length), currency)} each`
          : unit === "percent"
            ? `${percent.toFixed(1)}% of 100%`
            : `${formatMoney(cents, currency)} total`}
      </Callout>
      <PrimaryButton label="Save expense" icon="check" onPress={save} />
    </AppScreen>
  );
}
