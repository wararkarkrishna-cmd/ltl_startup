import { z } from 'zod';

export const ExifDataSchema = z.object({
  hasExif: z.boolean().default(false),
  gpsLatitude: z.number().nullable().optional(),
  gpsLongitude: z.number().nullable().optional(),
  gpsAltitudeMeters: z.number().nullable().optional(),
  photoTimestamp: z.date().nullable().optional(),
  deviceMake: z.string().nullable().optional(),
  deviceModel: z.string().nullable().optional(),
  software: z.string().nullable().optional(),
  imageOrientation: z.number().int().min(1).max(8).default(1),
  imageWidth: z.number().int().nullable().optional(),
  imageHeight: z.number().int().nullable().optional(),
  source: z.enum(['EXIF_APP1', 'EXIF_TIFF', 'PNG_EXIF', 'CLIENT_FALLBACK', 'NONE']).default('NONE'),
  rawTags: z.record(z.any()).default({}),
});

export type ExifData = z.infer<typeof ExifDataSchema>;

export interface ExifParseOptions {
  fallbackGps?: {
    lat: number;
    lon: number;
  } | null;
  fallbackTimestamp?: Date | null;
}

/**
 * High-Performance Binary EXIF Parser for Freight POD Images
 * Supports JPEG APP1 (0xFFE1), TIFF (Little/Big Endian), and PNG eXIf chunks.
 */
export class ExifParser {
  /**
   * Parse EXIF metadata from an image binary buffer
   */
  public static parseExif(
    buffer: Buffer,
    options: ExifParseOptions = {}
  ): ExifData {
    if (!buffer || buffer.length < 8) {
      return this.createFallbackResult(options, 'NONE');
    }

    try {
      // 1. JPEG Detection (0xFF 0xD8)
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        return this.parseJpegExif(buffer, options);
      }

      // 2. TIFF Detection (0x49 0x49 = 'II' or 0x4D 0x4D = 'MM')
      if (
        (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
        (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
      ) {
        return this.parseTiffExif(buffer, 0, options, 'EXIF_TIFF');
      }

      // 3. PNG Detection (0x89 'P' 'N' 'G')
      if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      ) {
        return this.parsePngExif(buffer, options);
      }

      // 4. Fallback for stripped or non-binary format
      return this.createFallbackResult(options, 'CLIENT_FALLBACK');
    } catch {
      return this.createFallbackResult(options, 'CLIENT_FALLBACK');
    }
  }

  /**
   * Parse JPEG APP1 Segments for Exif Marker (0xFFE1)
   */
  private static parseJpegExif(buffer: Buffer, options: ExifParseOptions): ExifData {
    let offset = 2; // Skip SOI (0xFFD8)

    while (offset < buffer.length - 4) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];

      // 0xDA is SOS (Start of Scan), entropy data begins - stop header parsing
      if (marker === 0xda || marker === 0xd9) {
        break;
      }

      // Read marker length (Big-Endian, includes the 2 length bytes)
      const length = buffer.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > buffer.length) {
        break;
      }

      // Check for APP1 marker (0xE1)
      if (marker === 0xe1) {
        const app1Start = offset + 4;
        // Check for 'Exif\0\0' header (0x45 0x78 0x69 0x66 0x00 0x00)
        if (
          length >= 8 &&
          buffer[app1Start] === 0x45 &&
          buffer[app1Start + 1] === 0x78 &&
          buffer[app1Start + 2] === 0x69 &&
          buffer[app1Start + 3] === 0x66 &&
          buffer[app1Start + 4] === 0x00 &&
          buffer[app1Start + 5] === 0x00
        ) {
          const tiffStart = app1Start + 6;
          return this.parseTiffExif(buffer, tiffStart, options, 'EXIF_APP1');
        }
      }

      offset += 2 + length;
    }

    return this.createFallbackResult(options, 'CLIENT_FALLBACK');
  }

  /**
   * Parse PNG Chunks for 'eXIf' or text chunks
   */
  private static parsePngExif(buffer: Buffer, options: ExifParseOptions): ExifData {
    let offset = 8; // Skip PNG 8-byte signature

    while (offset < buffer.length - 8) {
      const length = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('ascii', offset + 4, offset + 8);

      if (chunkType === 'eXIf' && length > 8) {
        const chunkDataStart = offset + 8;
        // eXIf chunk may start directly with TIFF header (II or MM) or Exif header
        if (
          buffer[chunkDataStart] === 0x45 &&
          buffer[chunkDataStart + 1] === 0x78 &&
          buffer[chunkDataStart + 2] === 0x69 &&
          buffer[chunkDataStart + 3] === 0x66
        ) {
          return this.parseTiffExif(buffer, chunkDataStart + 6, options, 'PNG_EXIF');
        }
        return this.parseTiffExif(buffer, chunkDataStart, options, 'PNG_EXIF');
      }

      if (chunkType === 'IEND') {
        break;
      }

      // Next chunk: 4 bytes len + 4 bytes type + length data + 4 bytes CRC
      offset += 12 + length;
    }

    return this.createFallbackResult(options, 'CLIENT_FALLBACK');
  }

  /**
   * Parse TIFF Image File Directory (IFD0, Exif SubIFD, GPS SubIFD)
   */
  private static parseTiffExif(
    buffer: Buffer,
    tiffStart: number,
    options: ExifParseOptions,
    source: 'EXIF_APP1' | 'EXIF_TIFF' | 'PNG_EXIF'
  ): ExifData {
    if (tiffStart + 8 > buffer.length) {
      return this.createFallbackResult(options, source);
    }

    const byteOrderMarker = buffer.readUInt16BE(tiffStart);
    const isLE = byteOrderMarker === 0x4949; // 'II' = Little Endian, 'MM' = Big Endian
    const isBE = byteOrderMarker === 0x4d4d;

    if (!isLE && !isBE) {
      return this.createFallbackResult(options, source);
    }

    // Binary Readers
    const readU16 = (pos: number): number => {
      if (pos + 2 > buffer.length) return 0;
      return isLE ? buffer.readUInt16LE(pos) : buffer.readUInt16BE(pos);
    };

    const readU32 = (pos: number): number => {
      if (pos + 4 > buffer.length) return 0;
      return isLE ? buffer.readUInt32LE(pos) : buffer.readUInt32BE(pos);
    };

    const readRational = (pos: number): number => {
      if (pos + 8 > buffer.length) return 0;
      const num = readU32(pos);
      const den = readU32(pos + 4);
      if (den === 0) return 0;
      return num / den;
    };

    const readString = (pos: number, len: number): string => {
      if (pos + len > buffer.length) return '';
      let str = buffer.toString('utf8', pos, pos + len);
      const nullIdx = str.indexOf('\0');
      if (nullIdx !== -1) {
        str = str.substring(0, nullIdx);
      }
      return str.trim();
    };

    // TIFF Header magic 42
    const magic = readU16(tiffStart + 2);
    if (magic !== 42) {
      return this.createFallbackResult(options, source);
    }

    // Offset to IFD0
    const ifd0Offset = readU32(tiffStart + 4);
    if (ifd0Offset === 0 || tiffStart + ifd0Offset >= buffer.length) {
      return this.createFallbackResult(options, source);
    }

    const rawTags: Record<string, any> = {};
    let make: string | null = null;
    let model: string | null = null;
    let software: string | null = null;
    let orientation = 1;
    let dateTimeStr: string | null = null;
    let exifSubIfdOffset: number | null = null;
    let gpsSubIfdOffset: number | null = null;
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;

    // Parse IFD Entries Helper
    const parseEntries = (offset: number, callback: (tag: number, type: number, count: number, valueOffset: number) => void) => {
      const numEntries = readU16(offset);
      let entryPos = offset + 2;

      for (let i = 0; i < numEntries; i++) {
        if (entryPos + 12 > buffer.length) break;
        const tag = readU16(entryPos);
        const type = readU16(entryPos + 2);
        const count = readU32(entryPos + 4);
        const valueOffset = entryPos + 8;
        callback(tag, type, count, valueOffset);
        entryPos += 12;
      }
    };

    // Parse IFD0
    parseEntries(tiffStart + ifd0Offset, (tag, type, count, valOffset) => {
      if (tag === 0x010f) {
        // Make
        const strOffset = count > 4 ? tiffStart + readU32(valOffset) : valOffset;
        make = readString(strOffset, count);
        rawTags.Make = make;
      } else if (tag === 0x0110) {
        // Model
        const strOffset = count > 4 ? tiffStart + readU32(valOffset) : valOffset;
        model = readString(strOffset, count);
        rawTags.Model = model;
      } else if (tag === 0x0112) {
        // Orientation
        orientation = readU16(valOffset);
        if (orientation < 1 || orientation > 8) orientation = 1;
        rawTags.Orientation = orientation;
      } else if (tag === 0x0131) {
        // Software
        const strOffset = count > 4 ? tiffStart + readU32(valOffset) : valOffset;
        software = readString(strOffset, count);
        rawTags.Software = software;
      } else if (tag === 0x0132) {
        // DateTime
        const strOffset = count > 4 ? tiffStart + readU32(valOffset) : valOffset;
        dateTimeStr = readString(strOffset, count);
        rawTags.DateTime = dateTimeStr;
      } else if (tag === 0x8769) {
        // Exif SubIFD Pointer
        exifSubIfdOffset = readU32(valOffset);
      } else if (tag === 0x8825) {
        // GPS Info SubIFD Pointer
        gpsSubIfdOffset = readU32(valOffset);
      } else if (tag === 0x0100) {
        // ImageWidth
        imageWidth = type === 3 ? readU16(valOffset) : readU32(valOffset);
      } else if (tag === 0x0101) {
        // ImageHeight
        imageHeight = type === 3 ? readU16(valOffset) : readU32(valOffset);
      }
    });

    // Parse Exif SubIFD if present
    if (exifSubIfdOffset && tiffStart + exifSubIfdOffset < buffer.length) {
      parseEntries(tiffStart + exifSubIfdOffset, (tag, type, count, valOffset) => {
        if (tag === 0x9003) {
          // DateTimeOriginal
          const strOffset = count > 4 ? tiffStart + readU32(valOffset) : valOffset;
          const origDate = readString(strOffset, count);
          if (origDate) {
            dateTimeStr = origDate;
            rawTags.DateTimeOriginal = origDate;
          }
        } else if (tag === 0x9004) {
          // DateTimeDigitized
          const strOffset = count > 4 ? tiffStart + readU32(valOffset) : valOffset;
          const digDate = readString(strOffset, count);
          rawTags.DateTimeDigitized = digDate;
        } else if (tag === 0xa002) {
          // PixelXDimension
          imageWidth = type === 3 ? readU16(valOffset) : readU32(valOffset);
        } else if (tag === 0xa003) {
          // PixelYDimension
          imageHeight = type === 3 ? readU16(valOffset) : readU32(valOffset);
        }
      });
    }

    // Parse GPS SubIFD if present
    let gpsLat: number | null = null;
    let gpsLon: number | null = null;
    let gpsAltitude: number | null = null;
    let latRef = 'N';
    let lonRef = 'W';
    let gpsDateStamp: string | null = null;
    let gpsTimeHour: number | null = null;
    let gpsTimeMin: number | null = null;
    let gpsTimeSec: number | null = null;

    if (gpsSubIfdOffset && tiffStart + gpsSubIfdOffset < buffer.length) {
      parseEntries(tiffStart + gpsSubIfdOffset, (tag, type, count, valOffset) => {
        if (tag === 0x0001) {
          // GPSLatitudeRef ('N' or 'S')
          latRef = buffer.toString('ascii', valOffset, valOffset + 1).toUpperCase();
          rawTags.GPSLatitudeRef = latRef;
        } else if (tag === 0x0002) {
          // GPSLatitude (3 RATIONALs: deg, min, sec)
          const dataOffset = tiffStart + readU32(valOffset);
          if (dataOffset + 24 <= buffer.length) {
            const deg = readRational(dataOffset);
            const min = readRational(dataOffset + 8);
            const sec = readRational(dataOffset + 16);
            gpsLat = this.dmsToDecimal(deg, min, sec, latRef);
            rawTags.GPSLatitude = gpsLat;
          }
        } else if (tag === 0x0003) {
          // GPSLongitudeRef ('E' or 'W')
          lonRef = buffer.toString('ascii', valOffset, valOffset + 1).toUpperCase();
          rawTags.GPSLongitudeRef = lonRef;
        } else if (tag === 0x0004) {
          // GPSLongitude (3 RATIONALs: deg, min, sec)
          const dataOffset = tiffStart + readU32(valOffset);
          if (dataOffset + 24 <= buffer.length) {
            const deg = readRational(dataOffset);
            const min = readRational(dataOffset + 8);
            const sec = readRational(dataOffset + 16);
            gpsLon = this.dmsToDecimal(deg, min, sec, lonRef);
            rawTags.GPSLongitude = gpsLon;
          }
        } else if (tag === 0x0006) {
          // GPSAltitude
          const dataOffset = tiffStart + readU32(valOffset);
          gpsAltitude = readRational(dataOffset);
          rawTags.GPSAltitude = gpsAltitude;
        } else if (tag === 0x0007) {
          // GPSTimeStamp (3 RATIONALs: hour, min, sec)
          const dataOffset = tiffStart + readU32(valOffset);
          if (dataOffset + 24 <= buffer.length) {
            gpsTimeHour = readRational(dataOffset);
            gpsTimeMin = readRational(dataOffset + 8);
            gpsTimeSec = readRational(dataOffset + 16);
          }
        } else if (tag === 0x001d) {
          // GPSDateStamp ("YYYY:MM:DD")
          const strOffset = count > 4 ? tiffStart + readU32(valOffset) : valOffset;
          gpsDateStamp = readString(strOffset, count);
        }
      });
    }

    // Parse DateTime to Date object
    let photoTimestamp: Date | null = null;
    if (dateTimeStr) {
      photoTimestamp = this.parseExifDateString(dateTimeStr);
    }

    if (!photoTimestamp && gpsDateStamp && gpsTimeHour !== null) {
      photoTimestamp = this.parseGpsDateTime(gpsDateStamp, gpsTimeHour, gpsTimeMin || 0, gpsTimeSec || 0);
    }

    // Apply Client Fallbacks if EXIF GPS or Timestamp is missing
    const finalLat = gpsLat ?? options.fallbackGps?.lat ?? null;
    const finalLon = gpsLon ?? options.fallbackGps?.lon ?? null;
    const finalTimestamp = photoTimestamp ?? options.fallbackTimestamp ?? new Date();

    const hasAnyExif = Boolean(
      gpsLat !== null ||
      gpsLon !== null ||
      make !== null ||
      model !== null ||
      dateTimeStr !== null ||
      orientation !== 1
    );

    return {
      hasExif: hasAnyExif,
      gpsLatitude: finalLat,
      gpsLongitude: finalLon,
      gpsAltitudeMeters: gpsAltitude,
      photoTimestamp: finalTimestamp,
      deviceMake: make,
      deviceModel: model,
      software,
      imageOrientation: orientation,
      imageWidth,
      imageHeight,
      source: hasAnyExif ? source : (options.fallbackGps ? 'CLIENT_FALLBACK' : 'NONE'),
      rawTags,
    };
  }

  /**
   * Convert Degrees, Minutes, Seconds to Decimal Degrees
   */
  public static dmsToDecimal(
    degrees: number,
    minutes: number,
    seconds: number,
    reference: string
  ): number {
    let decimal = degrees + minutes / 60.0 + seconds / 3600.0;
    const ref = reference.trim().toUpperCase();
    if (ref === 'S' || ref === 'W') {
      decimal = -decimal;
    }
    return Math.round(decimal * 1000000) / 1000000; // 6 decimal places (~0.11m precision)
  }

  /**
   * Parse "YYYY:MM:DD HH:MM:SS" EXIF Date Format
   */
  private static parseExifDateString(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const match = dateStr.match(/^(\d{4})[:/-](\d{2})[:/-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return null;

    const [, year, month, day, hour, min, sec] = match;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(min, 10),
      parseInt(sec, 10)
    );

    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Parse GPS UTC Date and Time Stamps
   */
  private static parseGpsDateTime(
    dateStamp: string,
    hour: number,
    min: number,
    sec: number
  ): Date | null {
    const parts = dateStamp.split(/[:/-]/);
    if (parts.length < 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    const date = new Date(Date.UTC(year, month - 1, day, Math.floor(hour), Math.floor(min), Math.floor(sec)));
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Fallback Result when EXIF is stripped or non-existent
   */
  private static createFallbackResult(
    options: ExifParseOptions,
    source: 'CLIENT_FALLBACK' | 'NONE' | 'EXIF_APP1' | 'EXIF_TIFF' | 'PNG_EXIF'
  ): ExifData {
    return {
      hasExif: false,
      gpsLatitude: options.fallbackGps?.lat ?? null,
      gpsLongitude: options.fallbackGps?.lon ?? null,
      gpsAltitudeMeters: null,
      photoTimestamp: options.fallbackTimestamp ?? new Date(),
      deviceMake: null,
      deviceModel: null,
      software: null,
      imageOrientation: 1,
      imageWidth: null,
      imageHeight: null,
      source: options.fallbackGps ? 'CLIENT_FALLBACK' : source,
      rawTags: {},
    };
  }
}
