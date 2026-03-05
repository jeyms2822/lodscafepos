import { useEffect, useMemo, useState } from 'react';
import { utils as xlsxUtils, writeFile as writeXlsxFile } from 'xlsx';

type Role = 'admin' | 'cashier' | 'employee';
type PaymentMethod = 'Cash' | 'GCash' | 'Bank Transfer';
type DiscountType = 'percent' | 'fixed';
type OrderStatus = 'Completed' | 'Voided';

type Product = {
  id: string;
  name: string;
  category: string;
  image: string;
  price: number;
  rawCost: number;
  stock: number;
};

type StaffAccount = {
  id: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  active: boolean;
};

type StoredStaffAccount = Omit<StaffAccount, 'name'> & { name?: string };

type OrderItem = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

type TransactionItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type Transaction = {
  orderId: string;
  receiptNo: string;
  createdAt: string;
  cashierName: string;
  items: TransactionItem[];
  subtotal: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  finalTotal: number;
  paymentMethod: PaymentMethod;
  paymentReceived: number;
  change: number;
  rawMaterialCost: number;
  status: OrderStatus;
};

const PHP = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
});

const CAFE_NAME = 'LODS CAFE';
const CAFE_ADDRESS = '1410 Kapanalig Barangay 28 Maypajo, Caloocan City.';
const RECEIPT_BRAND = 'Sip Up Coffee & Ko-Tea';

const defaultProducts: Product[] = [
  {
    id: 'p-1',
    name: 'Iced Latte',
    category: 'Coffee',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80&auto=format&fit=crop',
    price: 120,
    rawCost: 45,
    stock: 30
  },
  {
    id: 'p-2',
    name: 'Caramel Macchiato',
    category: 'Coffee',
    image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&q=80&auto=format&fit=crop',
    price: 150,
    rawCost: 60,
    stock: 24
  },
  {
    id: 'p-3',
    name: 'Chocolate Cake Slice',
    category: 'Pastry',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&q=80&auto=format&fit=crop',
    price: 95,
    rawCost: 35,
    stock: 18
  },
  {
    id: 'p-4',
    name: 'Blueberry Muffin',
    category: 'Pastry',
    image: 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400&q=80&auto=format&fit=crop',
    price: 75,
    rawCost: 28,
    stock: 20
  },
  {
    id: 'p-5',
    name: 'Matcha Frappe',
    category: 'Non-Coffee',
    image: 'https://images.unsplash.com/photo-1527169402691-a5b87f1b834f?w=400&q=80&auto=format&fit=crop',
    price: 165,
    rawCost: 70,
    stock: 16
  }
];

const defaultStaff: StaffAccount[] = [
  {
    id: 's-admin',
    name: 'System Admin',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    active: true
  },
  {
    id: 's-cashier-1',
    name: 'Cashier 1',
    username: 'cashier1',
    password: 'cash123',
    role: 'cashier',
    active: true
  }
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const loadStorage = <T,>(key: string, fallback: T): T => {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const clampMin = (value: number, min = 0) => (value < min ? min : value);

const normalizeStaffAccounts = (accounts: StoredStaffAccount[]): StaffAccount[] =>
  accounts.map((account) => ({
    ...account,
    name: account.name?.trim() || account.username
  }));

const normalizeStoredArray = <T,>(value: unknown, fallback: T[]): T[] => (Array.isArray(value) ? (value as T[]) : fallback);

const printTransaction = (transaction: Transaction): boolean => {
  const popup = window.open('', '_blank', 'width=700,height=900');
  if (!popup) {
    return false;
  }
  const items = transaction.items
    .map(
      (item) =>
        `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${PHP.format(item.unitPrice)}</td><td>${PHP.format(
          item.quantity * item.unitPrice
        )}</td></tr>`
    )
    .join('');

  popup.document.write(`
    <html>
      <head>
        <title>${RECEIPT_BRAND} - ${transaction.receiptNo}</title>
        <style>
          @page { size: 58mm auto; margin: 2mm; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            width: 54mm;
            margin: 0 auto;
            padding: 0;
            font-size: 11px;
            line-height: 1.25;
          }
          h2 {
            margin: 0 0 6px;
            text-align: center;
            font-size: 13px;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          td, th { border-bottom: 1px dashed #444; padding: 3px 0; text-align: left; font-size: 10px; }
          th:last-child,
          td:last-child { text-align: right; }
          .meta { margin: 2px 0; }
          .center { text-align: center; }
          .total { margin-top: 6px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h2>${RECEIPT_BRAND}</h2>
        <div class="meta center">${CAFE_ADDRESS}</div>
        <div class="meta">Receipt #: ${transaction.receiptNo}</div>
        <div class="meta">Order ID: ${transaction.orderId}</div>
        <div class="meta">Date & Time: ${new Date(transaction.createdAt).toLocaleString()}</div>
        <div class="meta">Cashier: ${transaction.cashierName}</div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
        <p>Subtotal: ${PHP.format(transaction.subtotal)}</p>
        <p>Discount: ${PHP.format(transaction.discountAmount)}</p>
        <p class="total">Total Paid: ${PHP.format(transaction.finalTotal)}</p>
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  const runPrint = () => {
    popup.print();
  };
  if (popup.document.readyState === 'complete') {
    setTimeout(runPrint, 120);
  } else {
    popup.onload = () => setTimeout(runPrint, 120);
  }
  return true;
};

function App() {
  const [products, setProducts] = useState<Product[]>(() =>
    normalizeStoredArray<Product>(loadStorage<unknown>('lods.products', defaultProducts), defaultProducts)
  );
  const [staff, setStaff] = useState<StaffAccount[]>(() =>
    normalizeStaffAccounts(
      normalizeStoredArray<StoredStaffAccount>(loadStorage<unknown>('lods.staff', defaultStaff), defaultStaff)
    )
  );
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    normalizeStoredArray<Transaction>(loadStorage<unknown>('lods.transactions', []), [])
  );

  const [search, setSearch] = useState('');
  const [cardQty, setCardQty] = useState<Record<string, number>>({});
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [notice, setNotice] = useState('');

  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentReceived, setPaymentReceived] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);

  const [tab, setTab] = useState<'pos' | 'dashboard' | 'history' | 'staff'>('pos');
  const [lastReceipt, setLastReceipt] = useState<Transaction | null>(null);
  const [viewTransaction, setViewTransaction] = useState<Transaction | null>(null);

  const [currentUserId, setCurrentUserId] = useState('');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  const [staffForm, setStaffForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'cashier' as Role,
    active: true
  });
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({
    id: '',
    name: '',
    category: '',
    image: '',
    price: 0,
    rawCost: 0,
    stock: 0
  });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());

  useEffect(() => {
    localStorage.setItem('lods.products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('lods.staff', JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    localStorage.setItem('lods.transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timeout);
  }, [notice]);

  const activeAccounts = useMemo(() => staff.filter((account) => account.active), [staff]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }
    const userStillExists = activeAccounts.some((account) => account.id === currentUserId);
    if (!userStillExists) {
      setCurrentUserId('');
      setNotice('Current account is inactive. Please sign in again.');
    }
  }, [activeAccounts, currentUserId]);

  const currentAccount = useMemo(
    () => activeAccounts.find((account) => account.id === currentUserId) ?? null,
    [activeAccounts, currentUserId]
  );

  const role: Role = currentAccount?.role ?? 'employee';
  const canAdmin = role === 'admin';
  const canHistory = role === 'admin' || role === 'cashier';
  const canVoid = role === 'admin' || role === 'cashier';
  const adminCount = useMemo(() => staff.filter((account) => account.role === 'admin').length, [staff]);

  const orderEnriched = useMemo(
    () =>
      orderItems
        .map((item) => {
          const product = products.find((productItem) => productItem.id === item.productId);
          if (!product) {
            return null;
          }
          return {
            ...item,
            name: product.name,
            lineTotal: item.quantity * item.unitPrice
          };
        })
        .filter(Boolean) as Array<OrderItem & { name: string; lineTotal: number }>,
    [orderItems, products]
  );

  const subtotal = useMemo(() => orderEnriched.reduce((sum, item) => sum + item.lineTotal, 0), [orderEnriched]);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.min(subtotal, clampMin((subtotal * discountValue) / 100));
    }
    return Math.min(subtotal, clampMin(discountValue));
  }, [discountType, discountValue, subtotal]);

  const finalTotal = useMemo(() => clampMin(subtotal - discountAmount), [subtotal, discountAmount]);

  const change = useMemo(() => paymentReceived - finalTotal, [paymentReceived, finalTotal]);
  const paymentShort = paymentMethod === 'Cash' && change < 0;
  const hasOrderItems = orderEnriched.length > 0;
  const canOpenCheckout = Boolean(currentAccount) && hasOrderItems;
  const canProcessPayment = Boolean(currentAccount) && hasOrderItems && !(paymentMethod === 'Cash' && paymentShort);

  const orderedQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    orderItems.forEach((item) => {
      map[item.productId] = (map[item.productId] ?? 0) + item.quantity;
    });
    return map;
  }, [orderItems]);

  const visibleProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return products.filter(
      (product) =>
        (product.name ?? '').toLowerCase().includes(keyword) ||
        (product.category ?? '').toLowerCase().includes(keyword)
    );
  }, [products, search]);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    visibleProducts.forEach((product) => {
      if (!groups[product.category]) {
        groups[product.category] = [];
      }
      groups[product.category].push(product);
    });
    return groups;
  }, [visibleProducts]);

  const inRangeTransactions = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T23:59:59`).getTime();
    return transactions.filter((transaction) => {
      const time = new Date(transaction.createdAt).getTime();
      return time >= start && time <= end;
    });
  }, [transactions, startDate, endDate]);

  const metrics = useMemo(() => {
    const grossSales = inRangeTransactions
      .filter((transaction) => transaction.status === 'Completed')
      .reduce((sum, transaction) => sum + transaction.finalTotal, 0);
    const rawMaterialCost = inRangeTransactions
      .filter((transaction) => transaction.status === 'Completed')
      .reduce((sum, transaction) => sum + transaction.rawMaterialCost, 0);
    const netSales = grossSales - rawMaterialCost;
    const voidedSales = inRangeTransactions
      .filter((transaction) => transaction.status === 'Voided')
      .reduce((sum, transaction) => sum + transaction.finalTotal, 0);

    const totalTransactions = inRangeTransactions.length;
    const validTransactions = inRangeTransactions.filter((transaction) => transaction.status === 'Completed').length;
    const successRate = totalTransactions === 0 ? 0 : (validTransactions / totalTransactions) * 100;

    return {
      grossSales,
      rawMaterialCost,
      netSales,
      voidedSales,
      totalTransactions,
      validTransactions,
      successRate
    };
  }, [inRangeTransactions]);

  const setCurrentMonth = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    setStartDate(first);
    setEndDate(last);
  };

  const signIn = () => {
    const username = authForm.username.trim();
    const password = authForm.password;
    const account = staff.find(
      (staffItem) => staffItem.active && staffItem.username === username && staffItem.password === password
    );

    if (!account) {
      setAuthError('Invalid username/password or inactive account.');
      return;
    }

    setCurrentUserId(account.id);
    setAuthError('');
    setNotice('Signed in successfully.');
    setAuthForm({ username: '', password: '' });
  };

  const signOut = () => {
    setCurrentUserId('');
    setTab('pos');
    setShowCheckout(false);
    setAuthError('');
    setNotice('Signed out.');
  };

  const addToOrder = (product: Product) => {
    const qty = clampMin(Math.floor(cardQty[product.id] ?? 1), 1);
    const available = product.stock - (orderedQtyMap[product.id] ?? 0);
    if (available <= 0 || qty > available) {
      setNotice(`${product.name} stock is not enough. Added anyway, please restock.`);
    }

    setOrderItems((previous) => {
      const exists = previous.find((item) => item.productId === product.id);
      if (!exists) {
        return [...previous, { productId: product.id, quantity: qty, unitPrice: product.price }];
      }
      return previous.map((item) =>
        item.productId === product.id ? { ...item, quantity: item.quantity + qty } : item
      );
    });
  };

  const updateOrderQty = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems((previous) => previous.filter((item) => item.productId !== productId));
      return;
    }
    setOrderItems((previous) =>
      previous.map((item) => (item.productId === productId ? { ...item, quantity } : item))
    );
  };

  const resetCheckout = () => {
    setDiscountType('percent');
    setDiscountValue(0);
    setPaymentMethod('Cash');
    setPaymentReceived(0);
    setShowCheckout(false);
  };

  const finalizeCheckout = () => {
    if (!currentAccount) {
      setNotice('Sign in with a staff account before checkout.');
      return;
    }

    if (orderEnriched.length === 0) {
      setNotice('Add at least one product to proceed to checkout.');
      return;
    }

    if (paymentMethod === 'Cash' && paymentShort) {
      setNotice('Insufficient cash payment.');
      return;
    }

    const now = new Date();
    const orderId = `ORD-${now.getTime()}`;
    const receiptNo = `OR-${now.getTime().toString().slice(-8)}`;

    const transactionItems: TransactionItem[] = orderEnriched.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }));

    const rawMaterialCost = orderEnriched.reduce((sum, item) => {
      const product = products.find((productInfo) => productInfo.id === item.productId);
      if (!product) {
        return sum;
      }
      return sum + product.rawCost * item.quantity;
    }, 0);

    const paymentAmount = paymentMethod === 'Cash' ? paymentReceived : finalTotal;
    const transaction: Transaction = {
      orderId,
      receiptNo,
      createdAt: now.toISOString(),
      cashierName: currentAccount?.name ?? currentAccount?.username ?? 'Unknown',
      items: transactionItems,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      finalTotal,
      paymentMethod,
      paymentReceived: paymentAmount,
      change: paymentMethod === 'Cash' ? change : 0,
      rawMaterialCost,
      status: 'Completed'
    };

    setTransactions((previous) => [transaction, ...previous]);

    setProducts((previous) =>
      previous.map((product) => {
        const orderItem = orderItems.find((item) => item.productId === product.id);
        if (!orderItem) {
          return product;
        }
        return { ...product, stock: product.stock - orderItem.quantity };
      })
    );

    setOrderItems([]);
    setCardQty({});
    setLastReceipt(transaction);
    resetCheckout();
    setTab('pos');
  };

  const startEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductForm({
      id: product.id,
      name: product.name,
      category: product.category,
      image: product.image,
      price: product.price,
      rawCost: product.rawCost,
      stock: product.stock
    });
  };

  const clearProductForm = () => {
    setEditingProductId(null);
    setProductForm({ id: '', name: '', category: '', image: '', price: 0, rawCost: 0, stock: 0 });
  };

  const saveProduct = () => {
    if (!productForm.name || !productForm.category) {
      setNotice('Product name and category are required.');
      return;
    }

    const data: Product = {
      id: editingProductId ?? `p-${Date.now()}`,
      name: productForm.name,
      category: productForm.category,
      image:
        productForm.image ||
        'https://images.unsplash.com/photo-1521017432531-fbd92d768814?w=400&q=80&auto=format&fit=crop',
      price: clampMin(productForm.price),
      rawCost: clampMin(productForm.rawCost),
      stock: Math.floor(productForm.stock)
    };

    if (editingProductId) {
      setProducts((previous) => previous.map((product) => (product.id === editingProductId ? data : product)));
      setNotice('Product updated.');
    } else {
      setProducts((previous) => [data, ...previous]);
      setNotice('Product added.');
    }
    clearProductForm();
  };

  const saveStaff = () => {
    if (!staffForm.name || !staffForm.username || !staffForm.password) {
      setNotice('Name, username, and password are required for staff accounts.');
      return;
    }

    if (editingStaffId) {
      setStaff((previous) =>
        previous.map((account) =>
          account.id === editingStaffId
            ? {
                ...account,
                name: staffForm.name,
                username: staffForm.username,
                password: staffForm.password,
                role: staffForm.role,
                active: staffForm.active
              }
            : account
        )
      );
      setNotice('Staff account updated.');
    } else {
      setStaff((previous) => [
        {
          id: `s-${Date.now()}`,
          name: staffForm.name,
          username: staffForm.username,
          password: staffForm.password,
          role: staffForm.role,
          active: staffForm.active
        },
        ...previous
      ]);
      setNotice('Staff account added.');
    }

    setEditingStaffId(null);
    setStaffForm({ name: '', username: '', password: '', role: 'cashier', active: true });
  };

  const editStaff = (account: StaffAccount) => {
    setEditingStaffId(account.id);
    setStaffForm({
      name: account.name,
      username: account.username,
      password: account.password,
      role: account.role,
      active: account.active
    });
  };

  const toggleStaffActive = (id: string) => {
    const target = staff.find((account) => account.id === id);
    if (!target) {
      return;
    }
    const isSelf = id === currentUserId;
    const isLastAdmin = target.role === 'admin' && adminCount <= 1;
    if (isSelf) {
      setNotice('You cannot deactivate your currently signed-in account.');
      return;
    }
    if (isLastAdmin) {
      setNotice('At least one admin account must remain active.');
      return;
    }

    setStaff((previous) =>
      previous.map((account) => (account.id === id ? { ...account, active: !account.active } : account))
    );
  };

  const deleteStaff = (id: string) => {
    const target = staff.find((account) => account.id === id);
    if (!target) {
      return;
    }
    const isSelf = id === currentUserId;
    const isLastAdmin = target.role === 'admin' && adminCount <= 1;
    if (isSelf) {
      setNotice('You cannot delete your currently signed-in account.');
      return;
    }
    if (isLastAdmin) {
      setNotice('At least one admin account must remain.');
      return;
    }

    if (!window.confirm('Delete this staff account? This action cannot be undone.')) {
      return;
    }

    setStaff((previous) => previous.filter((account) => account.id !== id));
    setNotice('Staff account deleted.');
  };

  const voidTransaction = (orderId: string) => {
    if (!window.confirm('Void this order? This will mark it as non-profit.')) {
      return;
    }

    setTransactions((previous) =>
      previous.map((transaction) =>
        transaction.orderId === orderId ? { ...transaction, status: 'Voided' } : transaction
      )
    );
    setNotice('Order was voided.');
  };

  const exportHistory = () => {
    const rows = inRangeTransactions.map((transaction) => ({
      'Order ID': transaction.orderId,
      'Date/Time': new Date(transaction.createdAt).toLocaleString(),
      'Cashier Name': transaction.cashierName,
      'Items Count': transaction.items.reduce((sum, item) => sum + item.quantity, 0),
      'Discount Applied': `${
        transaction.discountType === 'percent' ? `${transaction.discountValue}%` : PHP.format(transaction.discountValue)
      } (${PHP.format(transaction.discountAmount)})`,
      'Final Total': transaction.finalTotal,
      'Payment Method': transaction.paymentMethod,
      Status: transaction.status
    }));

    const worksheet = xlsxUtils.json_to_sheet(rows);
    const workbook = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(workbook, worksheet, 'Transactions');
    writeXlsxFile(workbook, `lods-cafe-transactions-${startDate}-to-${endDate}.xlsx`);
    setNotice('Excel report exported.');
  };

  const downloadReceipt = (transaction: Transaction) => {
    const lines = [
      RECEIPT_BRAND,
      CAFE_ADDRESS,
      `Receipt #: ${transaction.receiptNo}`,
      `Order ID: ${transaction.orderId}`,
      `Date & Time: ${new Date(transaction.createdAt).toLocaleString()}`,
      `Cashier: ${transaction.cashierName}`,
      '---',
      ...transaction.items.map(
        (item) => `${item.name} x${item.quantity} @ ${PHP.format(item.unitPrice)} = ${PHP.format(item.quantity * item.unitPrice)}`
      ),
      '---',
      `Subtotal: ${PHP.format(transaction.subtotal)}`,
      `Discount: ${PHP.format(transaction.discountAmount)}`,
      `Total Paid: ${PHP.format(transaction.finalTotal)}`,
      `Payment Method: ${transaction.paymentMethod}`,
      `Change: ${PHP.format(transaction.change)}`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${transaction.receiptNo}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReceipt = (transaction: Transaction) => {
    const opened = printTransaction(transaction);
    if (!opened) {
      setNotice('Print window was blocked. Allow pop-ups for this site then try again.');
    }
  };

  const maxBreakdown = Math.max(metrics.netSales, metrics.grossSales, metrics.rawMaterialCost, metrics.voidedSales, 1);

  const discountQuick = [5, 10, 15, 20];
  const quickCash = [1000, 500, 100];

  return (
    <div className="app">
      {currentAccount && (
        <header className="topbar">
          <div>
            <h1>LODS CAFE POS</h1>
            <p>{new Date().toLocaleString()}</p>
          </div>
          <div className="session-box">
            <label>Signed In</label>
            <div className="signin-row">
              <span>
                {currentAccount.name} ({currentAccount.role})
              </span>
              <button onClick={signOut}>Sign Out</button>
            </div>
          </div>
        </header>
      )}

      {!currentAccount && (
        <section className="auth-center">
          <div className="panel auth-card">
            <h1>LODS CAFE POS</h1>
            <p>{new Date().toLocaleString()}</p>
            <label>Staff Sign In</label>
            <div className="signin-grid">
              <input
                placeholder="Username"
                value={authForm.username}
                onChange={(event) => setAuthForm((previous) => ({ ...previous, username: event.target.value }))}
              />
              <input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(event) => setAuthForm((previous) => ({ ...previous, password: event.target.value }))}
              />
              <button
                onClick={signIn}
                disabled={!authForm.username.trim() || !authForm.password.trim()}
              >
                Sign In
              </button>
            </div>
            {authError && <small className="error-text">{authError}</small>}
          </div>
        </section>
      )}

      {currentAccount && (
        <>
          <nav className="tabs">
            <button className={tab === 'pos' ? 'active' : ''} onClick={() => setTab('pos')}>
              POS
            </button>
            {canAdmin && (
              <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
                Dashboard
              </button>
            )}
            {canHistory && (
              <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
                Sales History
              </button>
            )}
            {canAdmin && (
              <button className={tab === 'staff' ? 'active' : ''} onClick={() => setTab('staff')}>
                Staff Accounts
              </button>
            )}
          </nav>

          {notice && <div className="notice">{notice}</div>}

          {tab === 'pos' && (
        <section className="pos-layout">
          <div className="menu-area">
            {currentAccount ? (
              <>
                <div className="panel">
                  <h2>{editingProductId ? 'Edit Product Item' : 'Add Product Item'}</h2>
                  <div className="grid-form">
                    <input
                      placeholder="Product name"
                      value={productForm.name}
                      onChange={(event) => setProductForm((previous) => ({ ...previous, name: event.target.value }))}
                    />
                    <input
                      placeholder="Category"
                      value={productForm.category}
                      onChange={(event) => setProductForm((previous) => ({ ...previous, category: event.target.value }))}
                    />
                    <input
                      placeholder="Image URL"
                      value={productForm.image}
                      onChange={(event) => setProductForm((previous) => ({ ...previous, image: event.target.value }))}
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      value={productForm.price}
                      onChange={(event) =>
                        setProductForm((previous) => ({ ...previous, price: Number(event.target.value) }))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Raw cost"
                      value={productForm.rawCost}
                      onChange={(event) =>
                        setProductForm((previous) => ({ ...previous, rawCost: Number(event.target.value) }))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Stock"
                      value={productForm.stock}
                      onChange={(event) =>
                        setProductForm((previous) => ({ ...previous, stock: Number(event.target.value) }))
                      }
                    />
                  </div>
                  <div className="row-actions">
                    <button onClick={saveProduct}>{editingProductId ? 'Update Product' : 'Add Product'}</button>
                    {editingProductId && <button onClick={clearProductForm}>Cancel</button>}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel-head">
                    <h2>Visual Product Catalog</h2>
                    <input
                      className="search"
                      placeholder="Search products"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>

                  {Object.keys(groupedProducts).length === 0 && <p>No products found.</p>}

                  {Object.entries(groupedProducts).map(([category, items]) => (
                    <div key={category} className="category-group">
                      <h3>{category}</h3>
                      <div className="card-grid">
                        {items.map((product) => {
                          const inOrder = orderedQtyMap[product.id] ?? 0;
                          const available = product.stock - inOrder;
                          return (
                            <article key={product.id} className="item-card">
                              <img src={product.image} alt={product.name} />
                              <div className="card-body">
                                <div className="card-top">
                                  <strong>{product.name}</strong>
                                  <button title="Edit product" className="icon-btn" onClick={() => startEditProduct(product)}>
                                    ✏️
                                  </button>
                                </div>
                                <p>{PHP.format(product.price)}</p>
                                <p className={available <= 0 ? 'stock low' : 'stock'}>
                                  Available stock: {available}
                                </p>
                                <div className="card-actions">
                                  <input
                                    type="number"
                                    min={1}
                                    value={cardQty[product.id] ?? 1}
                                    onChange={(event) =>
                                      setCardQty((previous) => ({
                                        ...previous,
                                        [product.id]: clampMin(Number(event.target.value), 1)
                                      }))
                                    }
                                  />
                                  <button onClick={() => addToOrder(product)} disabled={!currentAccount}>
                                    Add
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="panel">
                <h2>Visual Product Catalog</h2>
                <p>Sign in to view products.</p>
              </div>
            )}
          </div>

          <aside className="order-sidebar">
            <div className="panel sticky">
              <h2>Order Details</h2>
              <p>Date: {new Date().toLocaleDateString()}</p>
              <div className="order-list">
                {orderEnriched.length === 0 && <p className="muted">No items in current order.</p>}
                {orderEnriched.map((item) => (
                  <div key={item.productId} className="order-row">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{PHP.format(item.unitPrice)}</p>
                    </div>
                    <div className="qty-control">
                      <button onClick={() => updateOrderQty(item.productId, item.quantity - 1)}>-</button>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => updateOrderQty(item.productId, Number(event.target.value))}
                      />
                      <button onClick={() => updateOrderQty(item.productId, item.quantity + 1)}>+</button>
                    </div>
                    <span>{PHP.format(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="totals">
                <p>
                  <span>Subtotal</span>
                  <strong>{PHP.format(subtotal)}</strong>
                </p>
                <p>
                  <span>Total</span>
                  <strong>{PHP.format(finalTotal)}</strong>
                </p>
              </div>
              <button
                className="checkout-btn"
                onClick={() => setShowCheckout((previous) => !previous)}
                disabled={!canOpenCheckout}
              >
                {showCheckout ? 'Hide Checkout' : 'Checkout'}
              </button>

              {showCheckout && (
                <div className="checkout-box">
                  <h3>Order Summary</h3>
                  <div className="summary-list">
                    {orderEnriched.map((item) => (
                      <p key={`summary-${item.productId}`}>
                        {item.name} x{item.quantity} = {PHP.format(item.lineTotal)}
                      </p>
                    ))}
                    {orderEnriched.length === 0 && <p className="muted">No items in summary.</p>}
                  </div>
                  <div className="discount-row">
                    <select value={discountType} onChange={(event) => setDiscountType(event.target.value as DiscountType)}>
                      <option value="percent">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₱)</option>
                    </select>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(clampMin(Number(event.target.value)))}
                    />
                  </div>
                  {discountType === 'percent' && (
                    <div className="quick-row">
                      {discountQuick.map((rate) => (
                        <button key={rate} onClick={() => setDiscountValue(rate)}>
                          {rate}%
                        </button>
                      ))}
                    </div>
                  )}

                  <label>Payment Method</label>
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                    <option>Cash</option>
                    <option>GCash</option>
                    <option>Bank Transfer</option>
                  </select>

                  <label>Amount Received</label>
                  <input
                    type="number"
                    value={paymentReceived}
                    onChange={(event) => setPaymentReceived(clampMin(Number(event.target.value)))}
                    disabled={paymentMethod !== 'Cash'}
                  />

                  {paymentMethod === 'Cash' && (
                    <div className="quick-row">
                      {quickCash.map((amount) => (
                        <button key={amount} onClick={() => setPaymentReceived((previous) => previous + amount)}>
                          +{PHP.format(amount)}
                        </button>
                      ))}
                      <button onClick={() => setPaymentReceived(finalTotal)}>Exact Amount</button>
                    </div>
                  )}

                  <div className="totals">
                    <p>
                      <span>Discount</span>
                      <strong>-{PHP.format(discountAmount)}</strong>
                    </p>
                    <p className={paymentShort ? 'error' : ''}>
                      <span>Change</span>
                      <strong>{PHP.format(change)}</strong>
                    </p>
                  </div>

                  <button className="checkout-btn" onClick={finalizeCheckout} disabled={!canProcessPayment}>
                    Process Payment
                  </button>
                </div>
              )}
            </div>
          </aside>
        </section>
          )}

          {tab === 'dashboard' && canAdmin && (
        <section className="dashboard">
          <div className="panel filter-row">
            <h2>Gross Sales Dashboard & Analytics</h2>
            <div className="date-fields">
              <label>
                Start Date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                End Date
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <button onClick={setCurrentMonth}>Current Month</button>
            </div>
          </div>

          <div className="kpi-grid">
            <div className="kpi">
              <span>Net Sales</span>
              <strong>{PHP.format(metrics.netSales)}</strong>
            </div>
            <div className="kpi">
              <span>Gross Sales</span>
              <strong>{PHP.format(metrics.grossSales)}</strong>
            </div>
            <div className="kpi">
              <span>Raw Material Costs</span>
              <strong>{PHP.format(metrics.rawMaterialCost)}</strong>
            </div>
            <div className="kpi">
              <span>Voided Sales</span>
              <strong>{PHP.format(metrics.voidedSales)}</strong>
            </div>
            <div className="kpi">
              <span>Total Transactions</span>
              <strong>{metrics.totalTransactions}</strong>
            </div>
            <div className="kpi">
              <span>Total Valid Transactions</span>
              <strong>{metrics.validTransactions}</strong>
            </div>
            <div className="kpi">
              <span>Transaction Success Rate</span>
              <strong>{metrics.successRate.toFixed(2)}%</strong>
            </div>
          </div>

          <div className="panel">
            <h3>Visual Revenue Breakdown</h3>
            <div className="breakdown">
              <div>
                <span>Net Sales (Profit)</span>
                <div className="bar"><i style={{ width: `${(metrics.netSales / maxBreakdown) * 100}%` }} /></div>
                <strong>{PHP.format(metrics.netSales)}</strong>
              </div>
              <div>
                <span>Gross Revenue</span>
                <div className="bar"><i style={{ width: `${(metrics.grossSales / maxBreakdown) * 100}%` }} /></div>
                <strong>{PHP.format(metrics.grossSales)}</strong>
              </div>
              <div>
                <span>Raw Material Cost</span>
                <div className="bar"><i style={{ width: `${(metrics.rawMaterialCost / maxBreakdown) * 100}%` }} /></div>
                <strong>{PHP.format(metrics.rawMaterialCost)}</strong>
              </div>
              <div>
                <span>Lost Revenue (Voided)</span>
                <div className="bar"><i style={{ width: `${(metrics.voidedSales / maxBreakdown) * 100}%` }} /></div>
                <strong>{PHP.format(metrics.voidedSales)}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <h3>Period Summary</h3>
            <p>
              From {startDate} to {endDate}, LODS CAFE recorded {metrics.totalTransactions} total transactions with{' '}
              {metrics.validTransactions} valid sales, resulting in a {metrics.successRate.toFixed(2)}% success rate. Gross
              sales reached {PHP.format(metrics.grossSales)} while raw material costs were {PHP.format(metrics.rawMaterialCost)},
              yielding net sales of {PHP.format(metrics.netSales)} and voided sales of {PHP.format(metrics.voidedSales)}.
            </p>
          </div>
        </section>
          )}

          {tab === 'history' && canHistory && (
        <section className="history">
          <div className="panel filter-row">
            <h2>History Sales List & Auditing</h2>
            <div className="date-fields">
              <label>
                Start Date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label>
                End Date
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
              <button onClick={setCurrentMonth}>Current Month</button>
              <button onClick={exportHistory}>Export Excel</button>
            </div>
          </div>

          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date/Time</th>
                  <th>Cashier</th>
                  <th># Items</th>
                  <th>Discount</th>
                  <th>Final Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {inRangeTransactions.map((transaction) => (
                  <tr key={transaction.orderId}>
                    <td>{transaction.orderId}</td>
                    <td>{new Date(transaction.createdAt).toLocaleString()}</td>
                    <td>{transaction.cashierName}</td>
                    <td>{transaction.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                    <td>{PHP.format(transaction.discountAmount)}</td>
                    <td>{PHP.format(transaction.finalTotal)}</td>
                    <td>{transaction.paymentMethod}</td>
                    <td>
                      <span className={transaction.status === 'Voided' ? 'badge voided' : 'badge done'}>
                        {transaction.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button onClick={() => setViewTransaction(transaction)}>View</button>
                      <button onClick={() => handlePrintReceipt(transaction)}>Print</button>
                      {canVoid && transaction.status !== 'Voided' && (
                        <button onClick={() => voidTransaction(transaction.orderId)}>Void</button>
                      )}
                    </td>
                  </tr>
                ))}
                {inRangeTransactions.length === 0 && (
                  <tr>
                    <td colSpan={9}>No transactions in selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
          )}

          {tab === 'staff' && canAdmin && (
        <section className="staff">
          <div className="panel">
            <h2>Sub-Accounts & Staff Management</h2>
            <div className="grid-form">
              <input
                placeholder="Full name"
                value={staffForm.name}
                onChange={(event) => setStaffForm((previous) => ({ ...previous, name: event.target.value }))}
              />
              <input
                placeholder="Username"
                value={staffForm.username}
                onChange={(event) => setStaffForm((previous) => ({ ...previous, username: event.target.value }))}
              />
              <input
                placeholder="Password"
                value={staffForm.password}
                onChange={(event) => setStaffForm((previous) => ({ ...previous, password: event.target.value }))}
              />
              <select
                value={staffForm.role}
                onChange={(event) => setStaffForm((previous) => ({ ...previous, role: event.target.value as Role }))}
              >
                <option value="cashier">cashier</option>
                <option value="employee">employee</option>
                <option value="admin">admin</option>
              </select>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={staffForm.active}
                  onChange={(event) => setStaffForm((previous) => ({ ...previous, active: event.target.checked }))}
                />
                Active
              </label>
            </div>
            <div className="row-actions">
              <button onClick={saveStaff}>{editingStaffId ? 'Update Account' : 'Add Account'}</button>
              {editingStaffId && (
                <button
                  onClick={() => {
                    setEditingStaffId(null);
                    setStaffForm({ name: '', username: '', password: '', role: 'cashier', active: true });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{account.username}</td>
                    <td>{account.role}</td>
                    <td>{account.active ? 'Active' : 'Inactive'}</td>
                    <td className="actions-cell">
                      {(() => {
                        const isSelf = account.id === currentUserId;
                        const isLastAdmin = account.role === 'admin' && adminCount <= 1;
                        return (
                          <>
                            <button onClick={() => editStaff(account)}>Edit</button>
                            <button onClick={() => toggleStaffActive(account.id)} disabled={isSelf || isLastAdmin}>
                              {account.active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => deleteStaff(account.id)} disabled={isSelf || isLastAdmin}>
                              Delete
                            </button>
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
          )}

          {(lastReceipt || viewTransaction) && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>{RECEIPT_BRAND}</h2>
            {(() => {
              const record = lastReceipt ?? viewTransaction;
              if (!record) {
                return null;
              }
              return (
                <>
                  <p>
                    <strong>{RECEIPT_BRAND}</strong>
                  </p>
                  <p>{CAFE_ADDRESS}</p>
                  <p>Receipt #: {record.receiptNo}</p>
                  <p>Date/Time: {new Date(record.createdAt).toLocaleString()}</p>
                  <p>Cashier: {record.cashierName}</p>
                  <div className="receipt-items">
                    {record.items.map((item) => (
                      <p key={`${record.orderId}-${item.productId}`}>
                        {item.name} x{item.quantity} - {PHP.format(item.quantity * item.unitPrice)}
                      </p>
                    ))}
                  </div>
                  <p>Subtotal: {PHP.format(record.subtotal)}</p>
                  <p>Total Paid: {PHP.format(record.finalTotal)}</p>
                  <div className="row-actions">
                    <button onClick={() => downloadReceipt(record)}>Download</button>
                    <button onClick={() => handlePrintReceipt(record)}>Print</button>
                    <button
                      onClick={() => {
                        setLastReceipt(null);
                        setViewTransaction(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
          )}

          <footer className="app-footer">
            <strong>{CAFE_NAME}</strong>
            <p>{CAFE_ADDRESS}</p>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
