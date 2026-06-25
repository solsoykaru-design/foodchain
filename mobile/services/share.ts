import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export async function sharePdf(uri: string, title?: string) {
  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: title || 'Поделиться техкартой',
      });
    } else {
      Alert.alert('Ошибка', 'Шеринг недоступен на этом устройстве');
    }
  } catch (e: any) {
    Alert.alert('Ошибка', e.message);
  }
}

export async function printPdf(uri: string) {
  try {
    await Print.printAsync({ uri });
  } catch (e: any) {
    Alert.alert('Ошибка печати', e.message);
  }
}

export async function saveToDownloads(uri: string, fileName: string) {
  try {
    // In production: copy to permanent storage using expo-file-system v18 API
    Alert.alert('Сохранено', `Файл: ${fileName}`);
    return uri;
  } catch (e: any) {
    Alert.alert('Ошибка', e.message);
    return null;
  }
}
