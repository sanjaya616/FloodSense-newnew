/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Legacy demonstration data module retained as empty arrays only.
 * FloodSense loads all incidents, hotspots, audit records, notifications,
 * and meteorological telemetry directly from Cloud Firestore,
 * Open-Meteo, and Gemini AI APIs without synthetic seed data.
 */

import { FloodReport, FloodHotspot, BlockchainRecord } from '../utils/floodLogic';

export const INITIAL_HOTSPOTS: FloodHotspot[] = [];
export const INITIAL_REPORTS: FloodReport[] = [];
export const INITIAL_BLOCKCHAIN_RECORDS: BlockchainRecord[] = [];
