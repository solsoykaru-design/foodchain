import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import * as api from '../api';

interface ContragentData {
  id: number;
  companyName: string;
  fullName: string;
  type: 'ip' | 'legal';
  inn?: string;
  kpp?: string;
  legalCountry: string;
  legalRegion?: string;
  legalCity?: string;
  legalStreet?: string;
  legalHouse?: string;
  legalIndex?: string;
  actualCountry: string;
  actualRegion?: string;
  actualCity?: string;
  actualStreet?: string;
  actualHouse?: string;
  actualIndex?: string;
  bankAccount?: string;
  bankName?: string;
  bankAddress?: string;
  bik?: string;
  correspondentAccount?: string;
  contractNumber?: string;
  contractDate?: string;
  vatIncluded: boolean;
  wholesalePriceList?: string;
  costItemDebit?: string;
  costItemCredit?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  supplierNumber?: string;
  workConditions?: string;
  description?: string;
  id1c?: string;
  minOrderSum?: string;
  creditLimit?: string;
  paymentDeferralDays?: string;
}

interface Props {
  contragent?: ContragentData | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AddContragentModal({ contragent, onClose, onSaved }: Props) {
  const isEdit = !!contragent;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 1.1 Organization data
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [type, setType] = useState<'ip' | 'legal'>('ip');
  const [inn, setInn] = useState('');
  const [kpp, setKpp] = useState('');

  // 1.2 Legal address
  const [legalCountry, setLegalCountry] = useState('Российская Федерация');
  const [legalRegion, setLegalRegion] = useState('');
  const [legalCity, setLegalCity] = useState('');
  const [legalStreet, setLegalStreet] = useState('');
  const [legalHouse, setLegalHouse] = useState('');
  const [legalIndex, setLegalIndex] = useState('');

  // 1.2 Actual address
  const [addressSame, setAddressSame] = useState(true);
  const [actualCountry, setActualCountry] = useState('Российская Федерация');
  const [actualRegion, setActualRegion] = useState('');
  const [actualCity, setActualCity] = useState('');
  const [actualStreet, setActualStreet] = useState('');
  const [actualHouse, setActualHouse] = useState('');
  const [actualIndex, setActualIndex] = useState('');

  // 1.3 Bank details
  const [bankAccount, setBankAccount] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAddress, setBankAddress] = useState('');
  const [bik, setBik] = useState('');
  const [correspondentAccount, setCorrespondentAccount] = useState('');

  // 1.4 Additional
  const [contractNumber, setContractNumber] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [vatIncluded, setVatIncluded] = useState(false);
  const [wholesalePriceList, setWholesalePriceList] = useState('');
  const [costItemDebit, setCostItemDebit] = useState('');
  const [costItemCredit, setCostItemCredit] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [supplierNumber, setSupplierNumber] = useState('');
  const [workConditions, setWorkConditions] = useState('');
  const [description, setDescription] = useState('');
  const [id1c, setId1c] = useState('');

  // 1.5 B2B
  const [minOrderSum, setMinOrderSum] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentDeferralDays, setPaymentDeferralDays] = useState('');

  useEffect(() => {
    if (contragent) {
      setCompanyName(contragent.companyName || '');
      setFullName(contragent.fullName || '');
      setType(contragent.type || 'ip');
      setInn(contragent.inn || '');
      setKpp(contragent.kpp || '');
      setLegalCountry(contragent.legalCountry || 'Российская Федерация');
      setLegalRegion(contragent.legalRegion || '');
      setLegalCity(contragent.legalCity || '');
      setLegalStreet(contragent.legalStreet || '');
      setLegalHouse(contragent.legalHouse || '');
      setLegalIndex(contragent.legalIndex || '');

      const aCountry = contragent.actualCountry || '';
      const aRegion = contragent.actualRegion || '';
      const aCity = contragent.actualCity || '';
      const aStreet = contragent.actualStreet || '';
      const aHouse = contragent.actualHouse || '';
      const aIndex = contragent.actualIndex || '';

      const same = (
        aCountry === (contragent.legalCountry || '') &&
        aRegion === (contragent.legalRegion || '') &&
        aCity === (contragent.legalCity || '') &&
        aStreet === (contragent.legalStreet || '') &&
        aHouse === (contragent.legalHouse || '') &&
        aIndex === (contragent.legalIndex || '')
      );

      setAddressSame(same);
      setActualCountry(aCountry || 'Российская Федерация');
      setActualRegion(aRegion);
      setActualCity(aCity);
      setActualStreet(aStreet);
      setActualHouse(aHouse);
      setActualIndex(aIndex);

      setBankAccount(contragent.bankAccount || '');
      setBankName(contragent.bankName || '');
      setBankAddress(contragent.bankAddress || '');
      setBik(contragent.bik || '');
      setCorrespondentAccount(contragent.correspondentAccount || '');
      setContractNumber(contragent.contractNumber || '');
      setContractDate(contragent.contractDate || '');
      setVatIncluded(contragent.vatIncluded || false);
      setWholesalePriceList(contragent.wholesalePriceList || '');
      setCostItemDebit(contragent.costItemDebit || '');
      setCostItemCredit(contragent.costItemCredit || '');
      setContactPerson(contragent.contactPerson || '');
      setPhone(contragent.phone || '');
      setEmail(contragent.email || '');
      setWebsite(contragent.website || '');
      setSupplierNumber(contragent.supplierNumber || '');
      setWorkConditions(contragent.workConditions || '');
      setDescription(contragent.description || '');
      setId1c(contragent.id1c || '');
      setMinOrderSum(contragent.minOrderSum || '');
      setCreditLimit(contragent.creditLimit || '');
      setPaymentDeferralDays(contragent.paymentDeferralDays || '');
    }
  }, [contragent]);

  const validate = (): string | null => {
    if (!companyName.trim()) return 'Название компании обязательно';
    if (!fullName.trim()) return 'Полное название юр. лица обязательно';
    if (inn && !/^\d{10}$|^\d{12}$/.test(inn)) return 'ИНН должен содержать 10 или 12 цифр';
    if (kpp && type === 'legal' && !/^\d{9}$/.test(kpp)) return 'КПП должен содержать 9 цифр';
    if (bik && !/^\d{9}$/.test(bik)) return 'БИК должен содержать 9 цифр';
    if (bankAccount && !/^\d{20}$/.test(bankAccount)) return 'Расчётный счёт должен содержать 20 цифр';
    if (correspondentAccount && !/^\d{20}$/.test(correspondentAccount)) return 'Корр. счёт должен содержать 20 цифр';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Некорректный email';
    return null;
  };

  const buildData = () => ({
    companyName: companyName.trim(),
    fullName: fullName.trim(),
    type,
    inn: inn.replace(/\s/g, '') || undefined,
    kpp: kpp.replace(/\s/g, '') || undefined,
    legalCountry, legalRegion: legalRegion.trim() || undefined,
    legalCity: legalCity.trim() || undefined, legalStreet: legalStreet.trim() || undefined,
    legalHouse: legalHouse.trim() || undefined, legalIndex: legalIndex.trim() || undefined,
    actualCountry: addressSame ? legalCountry : actualCountry,
    actualRegion: addressSame ? legalRegion : (actualRegion.trim() || undefined),
    actualCity: addressSame ? legalCity : (actualCity.trim() || undefined),
    actualStreet: addressSame ? legalStreet : (actualStreet.trim() || undefined),
    actualHouse: addressSame ? legalHouse : (actualHouse.trim() || undefined),
    actualIndex: addressSame ? legalIndex : (actualIndex.trim() || undefined),
    bankAccount: bankAccount.replace(/\s/g, '') || undefined,
    bankName: bankName.trim() || undefined,
    bankAddress: bankAddress.trim() || undefined,
    bik: bik.replace(/\s/g, '') || undefined,
    correspondentAccount: correspondentAccount.replace(/\s/g, '') || undefined,
    contractNumber: contractNumber.trim() || undefined,
    contractDate: contractDate || undefined,
    vatIncluded,
    wholesalePriceList: wholesalePriceList.trim() || undefined,
    costItemDebit: costItemDebit.trim() || undefined,
    costItemCredit: costItemCredit.trim() || undefined,
    contactPerson: contactPerson.trim() || undefined,
    phone: phone.trim() || undefined,
    email: email.trim() || undefined,
    website: website.trim() || undefined,
    supplierNumber: supplierNumber.trim() || undefined,
    workConditions: workConditions.trim() || undefined,
    description: description.trim() || undefined,
    id1c: id1c.trim() || undefined,
    minOrderSum: minOrderSum || undefined,
    creditLimit: creditLimit || undefined,
    paymentDeferralDays: paymentDeferralDays || undefined,
  });

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');
    try {
      if (isEdit) {
        await api.updateContragent(contragent!.id, buildData());
      } else {
        await api.createContragent(buildData());
      }
      onSaved();
      onClose();
    } catch (e: any) { setError(e.message || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const syncAddress = () => {
    if (addressSame) {
      setActualCountry(legalCountry);
      setActualRegion(legalRegion);
      setActualCity(legalCity);
      setActualStreet(legalStreet);
      setActualHouse(legalHouse);
      setActualIndex(legalIndex);
    }
  };

  const fieldClass = "w-full border-2 border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400";
  const labelClass = "text-xs font-medium text-zinc-500 mb-1 block";

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-[720px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{isEdit ? 'Редактировать контрагента' : 'Новый контрагент'}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* 1.1 Organization data */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Данные организации</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Название компании *</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="ООО «Ромашка»" className={fieldClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Полное название юридического лица *</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Общество с ограниченной ответственностью «Ромашка»" className={fieldClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Тип контрагента</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" checked={type === 'ip'} onChange={() => setType('ip')} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">ИП</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="type" checked={type === 'legal'} onChange={() => setType('legal')} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">Юр. лицо</span>
                  </label>
                </div>
              </div>
              <div>
                <label className={labelClass}>ИНН</label>
                <input value={inn} onChange={e => setInn(e.target.value.replace(/\D/g, '').slice(0, 12))} maxLength={12} placeholder="7712345678" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>КПП {type === 'ip' ? '(опционально)' : '*'}</label>
                <input value={kpp} onChange={e => setKpp(e.target.value.replace(/\D/g, '').slice(0, 9))} maxLength={9} placeholder="771201001" className={fieldClass} />
              </div>
            </div>
          </div>

          {/* 1.2 Legal address */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Юридический адрес</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className={labelClass}>Страна *</label>
                <select value={legalCountry} onChange={e => setLegalCountry(e.target.value)} className={fieldClass}>
                  <option>Российская Федерация</option>
                  <option>Казахстан</option>
                  <option>Беларусь</option>
                  <option>Другое</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Область</label>
                <input value={legalRegion} onChange={e => setLegalRegion(e.target.value)} placeholder="Московская область" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Город *</label>
                <input value={legalCity} onChange={e => setLegalCity(e.target.value)} placeholder="Москва" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Улица</label>
                <input value={legalStreet} onChange={e => setLegalStreet(e.target.value)} placeholder="ул. Ленина" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Номер дома</label>
                <input value={legalHouse} onChange={e => setLegalHouse(e.target.value)} placeholder="д. 1" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Почтовый индекс</label>
                <input value={legalIndex} onChange={e => setLegalIndex(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} placeholder="101000" className={fieldClass} />
              </div>
            </div>
          </div>

          {/* 1.2 Actual address */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Фактический адрес</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addressSame} onChange={e => { setAddressSame(e.target.checked); if (!e.target.checked) syncAddress(); }} className="rounded" />
                <span className="text-xs text-zinc-500">Совпадает с юридическим</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className={labelClass}>Страна</label>
                <select value={addressSame ? legalCountry : actualCountry} onChange={e => setActualCountry(e.target.value)} disabled={addressSame} className={fieldClass}>
                  <option>Российская Федерация</option>
                  <option>Казахстан</option>
                  <option>Беларусь</option>
                  <option>Другое</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Область</label>
                <input value={addressSame ? legalRegion : actualRegion} onChange={e => setActualRegion(e.target.value)} disabled={addressSame} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Город</label>
                <input value={addressSame ? legalCity : actualCity} onChange={e => setActualCity(e.target.value)} disabled={addressSame} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Улица</label>
                <input value={addressSame ? legalStreet : actualStreet} onChange={e => setActualStreet(e.target.value)} disabled={addressSame} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Номер дома</label>
                <input value={addressSame ? legalHouse : actualHouse} onChange={e => setActualHouse(e.target.value)} disabled={addressSame} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Почтовый индекс</label>
                <input value={addressSame ? legalIndex : actualIndex} onChange={e => setActualIndex(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} disabled={addressSame} className={fieldClass} />
              </div>
            </div>
          </div>

          {/* 1.3 Bank details */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Банковские реквизиты</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelClass}>Расчетный счет</label>
                <input value={bankAccount} onChange={e => setBankAccount(e.target.value.replace(/\D/g, '').slice(0, 20))} maxLength={20} placeholder="40702810400000000000" className={fieldClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Название банка</label>
                <input value={bankName} onChange={e => setBankName(e.target.value.slice(0, 100))} maxLength={100} placeholder="ПАО Сбербанк" className={fieldClass} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Адрес банка</label>
                <input value={bankAddress} onChange={e => setBankAddress(e.target.value.slice(0, 100))} maxLength={100} placeholder="г. Москва, ул. Вавилова, д. 19" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>БИК</label>
                <input value={bik} onChange={e => setBik(e.target.value.replace(/\D/g, '').slice(0, 9))} maxLength={9} placeholder="044525225" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Корреспондентский счет</label>
                <input value={correspondentAccount} onChange={e => setCorrespondentAccount(e.target.value.replace(/\D/g, '').slice(0, 20))} maxLength={20} placeholder="30101810400000000225" className={fieldClass} />
              </div>
            </div>
          </div>

          {/* 1.4 Additional */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Дополнительно</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Номер договора</label>
                <input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="Д-2025/001" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Дата договора</label>
                <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} className={fieldClass} />
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)} className="rounded" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">НДС</span>
                </label>
              </div>
              <div>
                <label className={labelClass}>Оптовый прайс-лист</label>
                <input value={wholesalePriceList} onChange={e => setWholesalePriceList(e.target.value)} placeholder="Прайс-лист №1" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Докладная статья калькуляции</label>
                <input value={costItemDebit} onChange={e => setCostItemDebit(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Расходная статья калькуляции</label>
                <input value={costItemCredit} onChange={e => setCostItemCredit(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Контактное лицо</label>
                <input value={contactPerson} onChange={e => setContactPerson(e.target.value)} placeholder="Иванов Иван" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Телефон</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 (999) 123-45-67" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="info@example.com" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Веб-сайт</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Номер поставышки</label>
                <input value={supplierNumber} onChange={e => setSupplierNumber(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Условия работы</label>
                <input value={workConditions} onChange={e => setWorkConditions(e.target.value)} placeholder="Отсрочка 30 дней" className={fieldClass} />
              </div>
              <div className="col-span-3">
                <label className={labelClass}>Описание</label>
                <textarea value={description} onChange={e => setDescription(e.target.value.slice(0, 500))} maxLength={500} rows={2}
                  className={`${fieldClass} resize-none`} />
              </div>
              <div>
                <label className={labelClass}>Идентификатор 1С</label>
                <input value={id1c} onChange={e => setId1c(e.target.value)} className={fieldClass} />
              </div>
            </div>
          </div>

          {/* 1.5 B2B */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">B2B поставщик</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Минимальная сумма заказа</label>
                <input type="number" step="0.01" value={minOrderSum} onChange={e => setMinOrderSum(e.target.value)} placeholder="1000" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Кредитный лимит</label>
                <input type="number" step="0.01" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} placeholder="50000" className={fieldClass} />
              </div>
              <div>
                <label className={labelClass}>Отсрочка платежа (дней)</label>
                <input type="number" value={paymentDeferralDays} onChange={e => setPaymentDeferralDays(e.target.value)} placeholder="30" className={fieldClass} />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 px-6 pb-2">{error}</p>}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition active:scale-[0.97]">
            Отмена
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition active:scale-[0.97]">
            <Check size={16} /> {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
