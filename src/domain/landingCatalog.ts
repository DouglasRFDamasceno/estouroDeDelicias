export const landingFlavors = [
  {
    name: 'Ninho',
    note: 'Para os apaixonados por leite em pó.',
    symbol: '♡',
    color: 'vanilla',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Oreo',
    note: 'Seu biscoito favorito em um novo momento.',
    symbol: '✦',
    color: 'cookie',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Morango',
    note: 'Um toque de cor para adoçar o dia.',
    symbol: '♥',
    color: 'berry',
    prices: [750, 1300, 1800],
  },
  {
    name: 'Nutella',
    note: 'Um encontro que é pura delícia.',
    symbol: '✳',
    color: 'chocolate',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Maracujá',
    note: 'Para quem gosta de sair do comum.',
    symbol: '☀',
    color: 'passion',
    prices: [750, 1300, 1800],
  },
  {
    name: 'Limão',
    note: 'Uma escolha cheia de personalidade.',
    symbol: '✷',
    color: 'lime',
    prices: [750, 1300, 1800],
  },
  {
    name: 'Bom Bom',
    note: 'Um carinho para adoçar seu momento.',
    symbol: '♥',
    color: 'berry',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Paçoca',
    note: 'Um sabor que combina com uma boa pausa.',
    symbol: '✳',
    color: 'passion',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Choco Ninho',
    note: 'Uma dupla para deixar o dia mais doce.',
    symbol: '♡',
    color: 'vanilla',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Trufa de Chocolate',
    note: 'Para quem sempre escolhe chocolate.',
    symbol: '✦',
    color: 'chocolate',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Prestígio',
    note: 'Mais uma delícia para compartilhar.',
    symbol: '✷',
    color: 'cookie',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Ovomaltine',
    note: 'Uma escolha para os seus momentos favoritos.',
    symbol: '✳',
    color: 'chocolate',
    prices: [900, 1600, 2200],
  },
  {
    name: 'Cravejado',
    note: 'Um presente cheio de carinho.',
    symbol: '✦',
    color: 'passion',
    prices: [900, 1600, 2200],
  },
];

export const packageSizes = [50, 100, 150] as const;

export type LandingOrderItem = { flavor: string; size: number; quantity: number };

export function orderItemPrice(item: LandingOrderItem): number {
  const flavor = landingFlavors.find((value) => value.name === item.flavor);
  const sizeIndex = packageSizes.findIndex((value) => value === item.size);
  if (
    !flavor ||
    sizeIndex < 0 ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1 ||
    item.quantity > 99
  )
    throw new Error('INVALID_ORDER_ITEM');
  return flavor.prices[sizeIndex] * item.quantity;
}

export function orderSubtotal(items: LandingOrderItem[]): number {
  return items.reduce((sum, item) => sum + orderItemPrice(item), 0);
}

export function orderMessage(items: LandingOrderItem[], confirmedSubtotal?: number): string {
  if (!items.length) throw new Error('EMPTY_ORDER');
  const subtotal = confirmedSubtotal ?? orderSubtotal(items);
  const total = (subtotal / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return [
    'Olá! Gostaria de consultar este pedido de pipocas gourmet:',
    ...items.map((item) => `• ${item.quantity} × ${item.flavor} — ${item.size} g`),
    `Subtotal do cardápio: ${total} (sem frete).`,
    'Pode confirmar a disponibilidade, o valor final e as opções de entrega e pagamento?',
  ].join('\n');
}
