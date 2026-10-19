import { Text } from 'react-native';
import { InputField } from './InputField';
import { formatMoneyInput, moneyDigitsOnly, parseMoneyInput } from '@/lib/currency';
import { ui } from '@/theme/tokens';
import type { ComponentProps } from 'react';

type MoneyInputFieldProps = Omit<
  ComponentProps<typeof InputField>,
  'value' | 'onChangeText' | 'keyboardType' | 'leftIcon'
> & {
  /** Dígitos o número; se muestra formateado (es-AR). */
  value: string | number;
  /** Recibe siempre dígitos sin formato (ej. "30000"). */
  onChangeText: (digits: string) => void;
  /** Prefijo visible a la izquierda. Default "$". */
  currencySymbol?: string;
};

/**
 * Input de pesos ARS: muestra `$ 30.000` y notifica dígitos limpios al padre.
 */
export function MoneyInputField({
  value,
  onChangeText,
  currencySymbol = '$',
  placeholder = '0',
  ...props
}: MoneyInputFieldProps) {
  const digits = typeof value === 'number' ? moneyDigitsOnly(String(value)) : moneyDigitsOnly(value);
  const display = formatMoneyInput(digits);

  return (
    <InputField
      {...props}
      value={display}
      onChangeText={(text) => onChangeText(moneyDigitsOnly(text))}
      keyboardType="number-pad"
      placeholder={placeholder}
      leftIcon={
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            color: ui.colors.textSecondary,
            fontFamily: ui.typography.body.fontFamily,
          }}
        >
          {currencySymbol}
        </Text>
      }
    />
  );
}

export { parseMoneyInput, formatMoneyInput, moneyDigitsOnly };
