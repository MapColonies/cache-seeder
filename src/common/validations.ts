import { promises, constants } from 'node:fs';
import moment from 'moment';

export const zoomComparison = (fromZoom: number, toZoom: number): boolean => {
  const valid = fromZoom <= toZoom;
  return valid;
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await promises.access(filePath, constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
};

export const isValidDateFormat = (dateString: string): boolean => {
  const isValidDateFormat = moment(dateString, moment.ISO_8601, true).isValid();
  return isValidDateFormat;
};
