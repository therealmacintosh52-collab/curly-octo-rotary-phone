-- =============================================================================
-- 0045 — Intel: trouble codes and vehicle intelligence, native
--   * dtc_codes: the generic OBD-II definitions (SAE J2012 ranges plus the
--     common manufacturer codes), 194 rows inlined below as reference data
--     every install needs. Readable by every signed-in user; written only by
--     migrations.
--   * provider_cache: cached answers from free public providers (NHTSA
--     recalls and complaints), service role only, 24 h TTL from the app.
--   * vehicles gains engine, specs (the vPIC attributes worth showing) and
--     specs_source, filled from the VIN decode.
--   * intel_lookups: what the shop looked up (codes, VINs) for "recent".
--   * RPCs: dtc_definitions(codes[]), log_intel_lookup(kind, query),
--     recent_intel_lookups(limit), set_vehicle_specs(id, specs).
-- Re-runnable. Reversal: drop the three tables, the RPCs and the columns.
-- =============================================================================

create table if not exists public.dtc_codes (
  code          text primary key check (code ~ '^[PBCU][0-9A-F]{4}$'),
  description   text not null,
  system        text not null,  -- fuel_air | ignition_misfire | emissions | vvt | cooling | lubrication | charging | transmission | speed_idle | computer | hybrid_ev | body | chassis | network
  category      text not null,  -- powertrain | body | chassis | network
  is_generic    boolean not null default true,
  common_causes text[] not null default '{}',
  safety_flag   text check (safety_flag in ('brakes', 'srs', 'steering', 'ev_high_voltage'))
);
alter table public.dtc_codes enable row level security;
drop policy if exists dtc_codes_select on public.dtc_codes;
create policy dtc_codes_select on public.dtc_codes for select to authenticated using (true);
grant select on public.dtc_codes to authenticated;

insert into public.dtc_codes (code, description, system, category, common_causes, safety_flag) values
  ('P0010','"A" Camshaft Position Actuator Circuit (Bank 1)','vvt','powertrain','{"VVT solenoid","Wiring/connector","Low or dirty engine oil"}',null),
  ('P0011','"A" Camshaft Position - Timing Over-Advanced or System Performance (Bank 1)','vvt','powertrain','{"Low/dirty oil","VVT solenoid stuck","Timing chain stretch","Cam phaser"}',null),
  ('P0012','"A" Camshaft Position - Timing Over-Retarded (Bank 1)','vvt','powertrain','{"Low/dirty oil","VVT solenoid","Cam phaser","Timing chain"}',null),
  ('P0013','"B" Camshaft Position Actuator Circuit (Bank 1)','vvt','powertrain','{"Exhaust VVT solenoid","Wiring"}',null),
  ('P0014','"B" Camshaft Position - Timing Over-Advanced (Bank 1)','vvt','powertrain','{"Exhaust VVT solenoid","Oil condition","Cam phaser"}',null),
  ('P0016','Crankshaft Position - Camshaft Position Correlation (Bank 1 Sensor A)','vvt','powertrain','{"Timing chain stretch/jumped","Cam phaser","Tone wheel damage","Sensor"}',null),
  ('P0017','Crankshaft Position - Camshaft Position Correlation (Bank 1 Sensor B)','vvt','powertrain','{"Timing chain","Cam phaser","Sensor"}',null),
  ('P0018','Crankshaft Position - Camshaft Position Correlation (Bank 2 Sensor A)','vvt','powertrain','{"Timing chain","Cam phaser","Sensor"}',null),
  ('P0019','Crankshaft Position - Camshaft Position Correlation (Bank 2 Sensor B)','vvt','powertrain','{"Timing chain","Cam phaser","Sensor"}',null),
  ('P0020','"A" Camshaft Position Actuator Circuit (Bank 2)','vvt','powertrain','{"VVT solenoid","Wiring"}',null),
  ('P0021','"A" Camshaft Position - Timing Over-Advanced (Bank 2)','vvt','powertrain','{"Oil condition","VVT solenoid","Cam phaser"}',null),
  ('P0030','HO2S Heater Control Circuit (Bank 1 Sensor 1)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0031','HO2S Heater Control Circuit Low (Bank 1 Sensor 1)','emissions','powertrain','{"O2 sensor heater","Wiring"}',null),
  ('P0032','HO2S Heater Control Circuit High (Bank 1 Sensor 1)','emissions','powertrain','{"O2 sensor heater","Wiring short"}',null),
  ('P0036','HO2S Heater Control Circuit (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0037','HO2S Heater Control Circuit Low (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor heater","Wiring"}',null),
  ('P0038','HO2S Heater Control Circuit High (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor heater","Wiring short"}',null),
  ('P0050','HO2S Heater Control Circuit (Bank 2 Sensor 1)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0056','HO2S Heater Control Circuit (Bank 2 Sensor 2)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0087','Fuel Rail/System Pressure - Too Low','fuel_air','powertrain','{"Weak fuel pump","Clogged filter","High-pressure pump (GDI)","Fuel pressure sensor"}',null),
  ('P0088','Fuel Rail/System Pressure - Too High','fuel_air','powertrain','{"Fuel pressure regulator","High-pressure pump control","Sensor"}',null),
  ('P0100','Mass or Volume Air Flow Circuit','fuel_air','powertrain','{"MAF sensor","Wiring","Air leak after MAF"}',null),
  ('P0101','Mass or Volume Air Flow Circuit Range/Performance','fuel_air','powertrain','{"Dirty MAF","Intake leak after MAF","Clogged air filter","MAF sensor"}',null),
  ('P0102','Mass or Volume Air Flow Circuit Low Input','fuel_air','powertrain','{"MAF sensor","Wiring","Connector"}',null),
  ('P0103','Mass or Volume Air Flow Circuit High Input','fuel_air','powertrain','{"MAF sensor","Wiring"}',null),
  ('P0105','Manifold Absolute Pressure/Barometric Pressure Circuit','fuel_air','powertrain','{"MAP sensor","Vacuum hose","Wiring"}',null),
  ('P0106','Manifold Absolute Pressure/Barometric Pressure Circuit Range/Performance','fuel_air','powertrain','{"Vacuum leak","MAP sensor","Hose"}',null),
  ('P0107','Manifold Absolute Pressure/Barometric Pressure Circuit Low Input','fuel_air','powertrain','{"MAP sensor","Wiring"}',null),
  ('P0108','Manifold Absolute Pressure/Barometric Pressure Circuit High Input','fuel_air','powertrain','{"MAP sensor","Wiring"}',null),
  ('P0110','Intake Air Temperature Sensor 1 Circuit','fuel_air','powertrain','{"IAT sensor","Wiring"}',null),
  ('P0111','Intake Air Temperature Sensor 1 Circuit Range/Performance','fuel_air','powertrain','{"IAT sensor","Wiring"}',null),
  ('P0112','Intake Air Temperature Sensor 1 Circuit Low','fuel_air','powertrain','{"IAT sensor","Wiring short"}',null),
  ('P0113','Intake Air Temperature Sensor 1 Circuit High','fuel_air','powertrain','{"IAT sensor open","Wiring"}',null),
  ('P0115','Engine Coolant Temperature Sensor 1 Circuit','cooling','powertrain','{"ECT sensor","Wiring"}',null),
  ('P0116','Engine Coolant Temperature Sensor 1 Circuit Range/Performance','cooling','powertrain','{"ECT sensor","Thermostat","Wiring"}',null),
  ('P0117','Engine Coolant Temperature Sensor 1 Circuit Low','cooling','powertrain','{"ECT sensor","Wiring short"}',null),
  ('P0118','Engine Coolant Temperature Sensor 1 Circuit High','cooling','powertrain','{"ECT sensor open","Wiring"}',null),
  ('P0120','Throttle/Pedal Position Sensor/Switch "A" Circuit','fuel_air','powertrain','{"TPS","Throttle body","Wiring"}',null),
  ('P0121','Throttle/Pedal Position Sensor/Switch "A" Circuit Range/Performance','fuel_air','powertrain','{"TPS","Throttle body carbon","Wiring"}',null),
  ('P0122','Throttle/Pedal Position Sensor/Switch "A" Circuit Low Input','fuel_air','powertrain','{"TPS","Wiring"}',null),
  ('P0123','Throttle/Pedal Position Sensor/Switch "A" Circuit High Input','fuel_air','powertrain','{"TPS","Wiring"}',null),
  ('P0125','Insufficient Coolant Temperature for Closed Loop Fuel Control','cooling','powertrain','{"Thermostat stuck open","ECT sensor","Low coolant"}',null),
  ('P0128','Coolant Thermostat (Coolant Temperature Below Thermostat Regulating Temperature)','cooling','powertrain','{"Thermostat stuck open","ECT sensor","Low coolant","Cooling fan on constantly"}',null),
  ('P0130','O2 Sensor Circuit (Bank 1 Sensor 1)','emissions','powertrain','{"O2/AF sensor","Wiring","Exhaust leak"}',null),
  ('P0131','O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)','emissions','powertrain','{"O2 sensor","Exhaust leak","Wiring","Lean condition"}',null),
  ('P0132','O2 Sensor Circuit High Voltage (Bank 1 Sensor 1)','emissions','powertrain','{"O2 sensor","Wiring short","Rich condition"}',null),
  ('P0133','O2 Sensor Circuit Slow Response (Bank 1 Sensor 1)','emissions','powertrain','{"Aged O2 sensor","Exhaust leak","Contamination"}',null),
  ('P0134','O2 Sensor Circuit No Activity Detected (Bank 1 Sensor 1)','emissions','powertrain','{"O2 sensor","Heater circuit","Wiring"}',null),
  ('P0135','O2 Sensor Heater Circuit (Bank 1 Sensor 1)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0136','O2 Sensor Circuit (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor","Wiring","Exhaust leak"}',null),
  ('P0137','O2 Sensor Circuit Low Voltage (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor","Exhaust leak","Wiring"}',null),
  ('P0138','O2 Sensor Circuit High Voltage (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor","Wiring short"}',null),
  ('P0139','O2 Sensor Circuit Slow Response (Bank 1 Sensor 2)','emissions','powertrain','{"Aged O2 sensor","Exhaust leak"}',null),
  ('P0140','O2 Sensor Circuit No Activity Detected (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor","Wiring"}',null),
  ('P0141','O2 Sensor Heater Circuit (Bank 1 Sensor 2)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0150','O2 Sensor Circuit (Bank 2 Sensor 1)','emissions','powertrain','{"O2/AF sensor","Wiring","Exhaust leak"}',null),
  ('P0151','O2 Sensor Circuit Low Voltage (Bank 2 Sensor 1)','emissions','powertrain','{"O2 sensor","Exhaust leak","Lean condition"}',null),
  ('P0153','O2 Sensor Circuit Slow Response (Bank 2 Sensor 1)','emissions','powertrain','{"Aged O2 sensor","Exhaust leak"}',null),
  ('P0155','O2 Sensor Heater Circuit (Bank 2 Sensor 1)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0156','O2 Sensor Circuit (Bank 2 Sensor 2)','emissions','powertrain','{"O2 sensor","Wiring"}',null),
  ('P0161','O2 Sensor Heater Circuit (Bank 2 Sensor 2)','emissions','powertrain','{"O2 sensor heater","Fuse","Wiring"}',null),
  ('P0171','System Too Lean (Bank 1)','fuel_air','powertrain','{"Vacuum leak","PCV hose/valve","Dirty MAF","Weak fuel pump","Clogged injector","Exhaust leak before O2"}',null),
  ('P0172','System Too Rich (Bank 1)','fuel_air','powertrain','{"Leaking injector","High fuel pressure","MAF","Purge valve stuck open","Restricted air filter"}',null),
  ('P0174','System Too Lean (Bank 2)','fuel_air','powertrain','{"Vacuum leak","PCV hose/valve","Dirty MAF","Weak fuel pump","Exhaust leak"}',null),
  ('P0175','System Too Rich (Bank 2)','fuel_air','powertrain','{"Leaking injector","High fuel pressure","MAF","Purge valve"}',null),
  ('P0190','Fuel Rail Pressure Sensor "A" Circuit','fuel_air','powertrain','{"Fuel rail pressure sensor","Wiring"}',null),
  ('P0200','Injector Circuit/Open','fuel_air','powertrain','{"Injector","Wiring","Driver"}',null),
  ('P0201','Injector Circuit/Open - Cylinder 1','fuel_air','powertrain','{"Injector 1","Wiring"}',null),
  ('P0202','Injector Circuit/Open - Cylinder 2','fuel_air','powertrain','{"Injector 2","Wiring"}',null),
  ('P0203','Injector Circuit/Open - Cylinder 3','fuel_air','powertrain','{"Injector 3","Wiring"}',null),
  ('P0204','Injector Circuit/Open - Cylinder 4','fuel_air','powertrain','{"Injector 4","Wiring"}',null),
  ('P0217','Engine Coolant Over Temperature Condition','cooling','powertrain','{"Low coolant","Fan","Thermostat stuck closed","Water pump","Radiator"}',null),
  ('P0218','Transmission Fluid Over Temperature Condition','transmission','powertrain','{"Low fluid","Cooler restriction","Towing load","Torque converter"}',null),
  ('P0219','Engine Overspeed Condition','computer','powertrain','{"Driver over-rev","Downshift error"}',null),
  ('P0230','Fuel Pump Primary Circuit','fuel_air','powertrain','{"Fuel pump relay","Fuse","Wiring","Fuel pump control module"}',null),
  ('P0299','Turbocharger/Supercharger "A" Underboost Condition','fuel_air','powertrain','{"Boost leak","Wastegate","Turbo","Charge pipe clamp","Boost sensor"}',null),
  ('P0300','Random/Multiple Cylinder Misfire Detected','ignition_misfire','powertrain','{"Spark plugs","Coils","Vacuum leak","Fuel delivery","Low compression","Lifters/valvetrain","EGR stuck open"}',null),
  ('P0301','Cylinder 1 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0302','Cylinder 2 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0303','Cylinder 3 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0304','Cylinder 4 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0305','Cylinder 5 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0306','Cylinder 6 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0307','Cylinder 7 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0308','Cylinder 8 Misfire Detected','ignition_misfire','powertrain','{"Spark plug","Coil","Injector","Compression"}',null),
  ('P0316','Engine Misfire Detected on Startup (First 1000 Revolutions)','ignition_misfire','powertrain','{"Cam phasers","Coils/plugs","Fuel delivery on start"}',null),
  ('P0325','Knock Sensor 1 Circuit (Bank 1)','ignition_misfire','powertrain','{"Knock sensor","Wiring","Connector corrosion"}',null),
  ('P0327','Knock Sensor 1 Circuit Low (Bank 1)','ignition_misfire','powertrain','{"Knock sensor","Wiring"}',null),
  ('P0330','Knock Sensor 2 Circuit (Bank 2)','ignition_misfire','powertrain','{"Knock sensor","Wiring"}',null),
  ('P0335','Crankshaft Position Sensor "A" Circuit','ignition_misfire','powertrain','{"Crank sensor","Wiring","Reluctor"}',null),
  ('P0336','Crankshaft Position Sensor "A" Circuit Range/Performance','ignition_misfire','powertrain','{"Crank sensor","Reluctor damage","Wiring"}',null),
  ('P0340','Camshaft Position Sensor "A" Circuit (Bank 1)','ignition_misfire','powertrain','{"Cam sensor","Wiring","Timing"}',null),
  ('P0341','Camshaft Position Sensor "A" Circuit Range/Performance (Bank 1)','ignition_misfire','powertrain','{"Cam sensor","Timing chain","Wiring"}',null),
  ('P0345','Camshaft Position Sensor "A" Circuit (Bank 2)','ignition_misfire','powertrain','{"Cam sensor","Wiring"}',null),
  ('P0351','Ignition Coil "A" Primary/Secondary Circuit','ignition_misfire','powertrain','{"Coil 1","Wiring","Driver"}',null),
  ('P0352','Ignition Coil "B" Primary/Secondary Circuit','ignition_misfire','powertrain','{"Coil 2","Wiring"}',null),
  ('P0353','Ignition Coil "C" Primary/Secondary Circuit','ignition_misfire','powertrain','{"Coil 3","Wiring"}',null),
  ('P0354','Ignition Coil "D" Primary/Secondary Circuit','ignition_misfire','powertrain','{"Coil 4","Wiring"}',null),
  ('P0401','Exhaust Gas Recirculation Flow Insufficient Detected','emissions','powertrain','{"Clogged EGR passages","EGR valve","DPFE sensor","Vacuum solenoid"}',null),
  ('P0402','Exhaust Gas Recirculation Flow Excessive Detected','emissions','powertrain','{"EGR valve stuck open","DPFE sensor","Solenoid"}',null),
  ('P0403','Exhaust Gas Recirculation Control Circuit','emissions','powertrain','{"EGR solenoid","Wiring"}',null),
  ('P0404','Exhaust Gas Recirculation Control Circuit Range/Performance','emissions','powertrain','{"EGR valve position sensor","Carbon","Wiring"}',null),
  ('P0410','Secondary Air Injection System','emissions','powertrain','{"Air pump","Check valve","Relay","Fuse"}',null),
  ('P0411','Secondary Air Injection System Incorrect Flow Detected','emissions','powertrain','{"Check valve","Pump","Hoses"}',null),
  ('P0420','Catalyst System Efficiency Below Threshold (Bank 1)','emissions','powertrain','{"Catalytic converter","Downstream O2 sensor","Exhaust leak","Misfire/rich history","Oil consumption"}',null),
  ('P0430','Catalyst System Efficiency Below Threshold (Bank 2)','emissions','powertrain','{"Catalytic converter","Downstream O2 sensor","Exhaust leak","Misfire history"}',null),
  ('P0440','Evaporative Emission System','emissions','powertrain','{"Gas cap","Purge valve","Vent valve","Hose leak","Canister"}',null),
  ('P0441','Evaporative Emission System Incorrect Purge Flow','emissions','powertrain','{"Purge valve","Canister pump module","Blocked line","Vent valve"}',null),
  ('P0442','Evaporative Emission System Leak Detected (Small Leak)','emissions','powertrain','{"Gas cap","Hose crack","Purge/vent valve seal","Canister"}',null),
  ('P0443','Evaporative Emission System Purge Control Valve Circuit','emissions','powertrain','{"Purge valve","Wiring"}',null),
  ('P0446','Evaporative Emission System Vent Control Circuit','emissions','powertrain','{"Vent valve","Wiring","Blocked vent/filter"}',null),
  ('P0449','Evaporative Emission System Vent Valve/Solenoid Circuit','emissions','powertrain','{"Vent solenoid","Wiring","Connector"}',null),
  ('P0451','Evaporative Emission System Pressure Sensor/Switch Range/Performance','emissions','powertrain','{"FTP sensor","Wiring"}',null),
  ('P0452','Evaporative Emission System Pressure Sensor/Switch Low','emissions','powertrain','{"FTP sensor","Wiring"}',null),
  ('P0453','Evaporative Emission System Pressure Sensor/Switch High','emissions','powertrain','{"FTP sensor","Wiring","Blocked vent"}',null),
  ('P0455','Evaporative Emission System Leak Detected (Large Leak)','emissions','powertrain','{"Loose/missing gas cap","Disconnected hose","Vent valve stuck open","Canister crack"}',null),
  ('P0456','Evaporative Emission System Leak Detected (Very Small Leak)','emissions','powertrain','{"Gas cap seal","Hose pinhole","Purge valve seat","Canister"}',null),
  ('P0457','Evaporative Emission System Leak Detected (Fuel Cap Loose/Off)','emissions','powertrain','{"Gas cap"}',null),
  ('P0460','Fuel Level Sensor "A" Circuit','fuel_air','powertrain','{"Fuel level sender","Wiring"}',null),
  ('P0462','Fuel Level Sensor "A" Circuit Low','fuel_air','powertrain','{"Fuel level sender","Wiring"}',null),
  ('P0463','Fuel Level Sensor "A" Circuit High','fuel_air','powertrain','{"Fuel level sender","Wiring"}',null),
  ('P0480','Fan 1 Control Circuit','cooling','powertrain','{"Fan relay","Fan motor","Wiring","Fan control module"}',null),
  ('P0500','Vehicle Speed Sensor "A"','speed_idle','powertrain','{"VSS","Wiring","ABS wheel speed data"}',null),
  ('P0505','Idle Air Control System','speed_idle','powertrain','{"IAC valve","Throttle body carbon","Vacuum leak"}',null),
  ('P0506','Idle Air Control System RPM Lower Than Expected','speed_idle','powertrain','{"Throttle body carbon","Vacuum leak","IAC"}',null),
  ('P0507','Idle Air Control System RPM Higher Than Expected','speed_idle','powertrain','{"Vacuum leak","Throttle body","Relearn needed after cleaning"}',null),
  ('P0520','Engine Oil Pressure Sensor/Switch Circuit','lubrication','powertrain','{"Oil pressure sensor","Wiring","Clogged sensor screen"}',null),
  ('P0521','Engine Oil Pressure Sensor/Switch Range/Performance','lubrication','powertrain','{"Oil pressure sensor","Clogged pickup screen","Low oil","Oil pump"}',null),
  ('P0522','Engine Oil Pressure Sensor/Switch Low Voltage','lubrication','powertrain','{"Oil pressure sensor","Wiring","Low oil pressure"}',null),
  ('P0523','Engine Oil Pressure Sensor/Switch High Voltage','lubrication','powertrain','{"Oil pressure sensor","Wiring"}',null),
  ('P0560','System Voltage','charging','powertrain','{"Battery","Alternator","Ground","Wiring"}',null),
  ('P0562','System Voltage Low','charging','powertrain','{"Alternator","Battery","Belt","Ground"}',null),
  ('P0563','System Voltage High','charging','powertrain','{"Alternator regulator","Wiring"}',null),
  ('P0600','Serial Communication Link','network','powertrain','{"Wiring","Module","Ground"}',null),
  ('P0601','Internal Control Module Memory Check Sum Error','computer','powertrain','{"PCM","Software"}',null),
  ('P0602','Control Module Programming Error','computer','powertrain','{"PCM programming","Software"}',null),
  ('P0603','Internal Control Module Keep Alive Memory (KAM) Error','computer','powertrain','{"Battery disconnect","PCM power/ground","PCM"}',null),
  ('P0604','Internal Control Module Random Access Memory (RAM) Error','computer','powertrain','{"PCM"}',null),
  ('P0605','Internal Control Module Read Only Memory (ROM) Error','computer','powertrain','{"PCM"}',null),
  ('P0606','ECM/PCM Processor','computer','powertrain','{"PCM","Power/ground","Software"}',null),
  ('P0700','Transmission Control System (MIL Request)','transmission','powertrain','{"See TCM codes","TCM","Wiring"}',null),
  ('P0705','Transmission Range Sensor Circuit Malfunction (PRNDL Input)','transmission','powertrain','{"Range sensor","Shifter cable adjustment","Wiring"}',null),
  ('P0711','Transmission Fluid Temperature Sensor "A" Circuit Range/Performance','transmission','powertrain','{"TFT sensor","Wiring"}',null),
  ('P0715','Input/Turbine Speed Sensor "A" Circuit','transmission','powertrain','{"Input speed sensor","Wiring","Fluid contamination"}',null),
  ('P0720','Output Speed Sensor Circuit','transmission','powertrain','{"Output speed sensor","Wiring"}',null),
  ('P0730','Incorrect Gear Ratio','transmission','powertrain','{"Low fluid","Clutch wear","Valve body","CVT belt/chain"}',null),
  ('P0740','Torque Converter Clutch Circuit','transmission','powertrain','{"TCC solenoid","Wiring"}',null),
  ('P0741','Torque Converter Clutch Circuit Performance or Stuck Off','transmission','powertrain','{"Torque converter","TCC solenoid","Fluid","Valve body"}',null),
  ('P0742','Torque Converter Clutch Circuit Stuck On','transmission','powertrain','{"TCC solenoid","Valve body","Torque converter"}',null),
  ('P0744','Torque Converter Clutch Circuit Intermittent','transmission','powertrain','{"Torque converter","TCC solenoid","Wiring","CVT internal (Nissan)"}',null),
  ('P0750','Shift Solenoid "A"','transmission','powertrain','{"Shift solenoid","Wiring","Fluid"}',null),
  ('P0751','Shift Solenoid "A" Performance or Stuck Off','transmission','powertrain','{"Shift solenoid","Valve body","Fluid"}',null),
  ('P0755','Shift Solenoid "B"','transmission','powertrain','{"Shift solenoid","Wiring"}',null),
  ('P0776','Pressure Control Solenoid "B" Performance or Stuck Off','transmission','powertrain','{"Pressure control solenoid","Valve body","CVT fluid"}',null),
  ('P0780','Shift Malfunction','transmission','powertrain','{"Fluid","Valve body","Solenoid"}',null),
  ('P0A0F','Engine Failed to Start','hybrid_ev','powertrain','{"Hybrid system","Fuel","12V battery"}','ev_high_voltage'),
  ('P0A1F','Battery Energy Control Module','hybrid_ev','powertrain','{"Battery ECU","HV battery","Wiring"}','ev_high_voltage'),
  ('P0A7F','Hybrid Battery Pack Deterioration','hybrid_ev','powertrain','{"HV battery module(s)","Cooling fan filter","Cell imbalance"}','ev_high_voltage'),
  ('P0A80','Replace Hybrid Battery Pack','hybrid_ev','powertrain','{"HV battery module(s)","Cell imbalance"}','ev_high_voltage'),
  ('P0AA6','Hybrid Battery Voltage System Isolation Fault','hybrid_ev','powertrain','{"HV leak to chassis","Inverter","AC compressor","Battery"}','ev_high_voltage'),
  ('B0001','Driver Frontal Stage 1 Deployment Control','body','body','{"Airbag module","Clockspring","Connector"}','srs'),
  ('B0002','Driver Frontal Stage 2 Deployment Control','body','body','{"Airbag module","Clockspring","Connector"}','srs'),
  ('B0010','Passenger Frontal Stage 1 Deployment Control','body','body','{"Airbag module","Connector"}','srs'),
  ('B0011','Passenger Frontal Stage 2 Deployment Control','body','body','{"Airbag module","Connector"}','srs'),
  ('B0020','Left Side Airbag Deployment Control','body','body','{"Side airbag","Connector"}','srs'),
  ('B0021','Right Side Airbag Deployment Control','body','body','{"Side airbag","Connector"}','srs'),
  ('B0028','Left Side Curtain Airbag Deployment Control','body','body','{"Curtain airbag","Connector"}','srs'),
  ('B0051','Driver Seat Belt Pretensioner Deployment Control','body','body','{"Pretensioner","Connector under seat"}','srs'),
  ('B0052','Passenger Seat Belt Pretensioner Deployment Control','body','body','{"Pretensioner","Connector under seat"}','srs'),
  ('B0081','Passenger Presence Detection System','body','body','{"Occupant classification sensor","Seat connector"}','srs'),
  ('C0031','Left Front Wheel Speed Sensor Circuit','chassis','chassis','{"Wheel speed sensor","Tone ring","Wiring","Hub bearing"}','brakes'),
  ('C0034','Right Front Wheel Speed Sensor Circuit','chassis','chassis','{"Wheel speed sensor","Tone ring","Wiring"}','brakes'),
  ('C0035','Left Front Wheel Speed Sensor Circuit','chassis','chassis','{"Wheel speed sensor","Tone ring","Wiring","Hub bearing"}','brakes'),
  ('C0037','Left Rear Wheel Speed Sensor Circuit','chassis','chassis','{"Wheel speed sensor","Tone ring","Wiring"}','brakes'),
  ('C0040','Right Front Wheel Speed Sensor Circuit','chassis','chassis','{"Wheel speed sensor","Tone ring","Wiring"}','brakes'),
  ('C0045','Left Rear Wheel Speed Sensor Circuit','chassis','chassis','{"Wheel speed sensor","Tone ring","Wiring"}','brakes'),
  ('C0050','Right Rear Wheel Speed Sensor Circuit','chassis','chassis','{"Wheel speed sensor","Tone ring","Wiring"}','brakes'),
  ('C0110','Pump Motor Circuit','chassis','chassis','{"ABS pump motor","Relay","Ground"}','brakes'),
  ('C0121','Valve Relay Circuit','chassis','chassis','{"ABS module","Wiring"}','brakes'),
  ('C0161','ABS/TCS Brake Switch Circuit','chassis','chassis','{"Brake light switch","Wiring"}','brakes'),
  ('C0196','Steering Wheel Position Sensor Circuit','chassis','chassis','{"Steering angle sensor","Calibration","Clockspring"}','steering'),
  ('C0455','Steering Wheel Position Sensor Circuit','chassis','chassis','{"Steering angle sensor","Calibration"}','steering'),
  ('U0001','High Speed CAN Communication Bus','network','network','{"CAN wiring","Terminating resistor","Module short","Ground"}',null),
  ('U0073','Control Module Communication Bus "A" Off','network','network','{"CAN wiring","Module","Low battery voltage"}',null),
  ('U0100','Lost Communication With ECM/PCM "A"','network','network','{"PCM power/ground","CAN wiring","Low battery","PCM"}',null),
  ('U0101','Lost Communication With TCM','network','network','{"TCM power/ground","CAN wiring","TCM"}',null),
  ('U0121','Lost Communication With Anti-Lock Brake System (ABS) Control Module','network','network','{"ABS module power/ground","CAN wiring","ABS module"}','brakes'),
  ('U0140','Lost Communication With Body Control Module','network','network','{"BCM power/ground","CAN wiring"}',null),
  ('U0151','Lost Communication With Restraints Control Module','network','network','{"SRS module power/ground","CAN wiring"}','srs'),
  ('U0155','Lost Communication With Instrument Panel Cluster (IPC) Control Module','network','network','{"Cluster power/ground","CAN wiring"}',null),
  ('U0401','Invalid Data Received From ECM/PCM "A"','network','network','{"Low battery voltage","PCM software","CAN noise"}',null),
  ('U0402','Invalid Data Received From TCM','network','network','{"TCM software","CAN wiring"}',null),
  ('U0415','Invalid Data Received From Anti-Lock Brake System (ABS) Control Module','network','network','{"ABS module","Wheel speed data","CAN"}','brakes'),
  ('U1000','Manufacturer Controlled DTC - CAN Communication Line (Nissan)','network','network','{"CAN wiring","Module","Low battery during scan"}',null)
on conflict (code) do update set description = excluded.description, system = excluded.system, category = excluded.category, common_causes = excluded.common_causes, safety_flag = excluded.safety_flag;

-- ---------------------------------------------------------------------------
-- Provider cache (service role only; the app reads and writes it with the admin client)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_cache (
  cache_key  text primary key,
  provider   text not null,
  payload    jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.provider_cache enable row level security;
revoke all on public.provider_cache from anon, authenticated;
create index if not exists provider_cache_expires_idx on public.provider_cache (expires_at);

create or replace function public.cleanup_provider_cache()
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.provider_cache where expires_at < now() returning 1) select count(*)::int from d
$$;
revoke execute on function public.cleanup_provider_cache() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Vehicles: what the VIN decode knows
-- ---------------------------------------------------------------------------
alter table public.vehicles add column if not exists engine        text;
alter table public.vehicles add column if not exists specs         jsonb not null default '{}'::jsonb;
alter table public.vehicles add column if not exists specs_source  text;

-- Keeps the decoded attributes on the car (a member of the company, like the vehicle update policy).
create or replace function public.set_vehicle_specs(p_id uuid, p_engine text, p_specs jsonb, p_source text default 'NHTSA')
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.vehicles
     set engine = coalesce(nullif(trim(p_engine), ''), engine),
         specs = coalesce(p_specs, '{}'::jsonb),
         specs_source = p_source
   where id = p_id and company_id = public.current_company_id();
  if not found then raise exception 'vehicle not found' using errcode = 'P0002'; end if;
end $$;
grant execute on function public.set_vehicle_specs(uuid, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- What the shop looked up (codes and VINs), for "recent" on the Codes screen
-- ---------------------------------------------------------------------------
create table if not exists public.intel_lookups (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  kind       text not null check (kind in ('code', 'vin')),
  query      text not null,
  created_at timestamptz not null default now()
);
create index if not exists intel_lookups_company_idx on public.intel_lookups (company_id, created_at desc);
alter table public.intel_lookups enable row level security;
drop policy if exists intel_lookups_select on public.intel_lookups;
create policy intel_lookups_select on public.intel_lookups for select to authenticated using (company_id = public.current_company_id());
grant select on public.intel_lookups to authenticated;

create or replace function public.log_intel_lookup(p_kind text, p_query text)
returns void language plpgsql security definer set search_path = public as $$
declare q text := left(trim(p_query), 200);
begin
  if public.current_company_id() is null or q = '' then return; end if;
  -- the same query again moves to the top instead of piling up
  delete from public.intel_lookups where company_id = public.current_company_id() and kind = p_kind and query = q;
  -- clock_timestamp(): several lookups in one transaction still order newest first
  insert into public.intel_lookups (company_id, user_id, kind, query, created_at) values (public.current_company_id(), auth.uid(), p_kind, q, clock_timestamp());
  delete from public.intel_lookups where company_id = public.current_company_id()
     and id not in (select id from public.intel_lookups where company_id = public.current_company_id() order by created_at desc limit 50);
end $$;
grant execute on function public.log_intel_lookup(text, text) to authenticated;

create or replace function public.recent_intel_lookups(p_limit int default 8)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'query', l.query, 'at', l.created_at) order by l.created_at desc), '[]'::jsonb)
  from (select * from public.intel_lookups where company_id = public.current_company_id() order by created_at desc limit greatest(1, least(p_limit, 50))) l
$$;
grant execute on function public.recent_intel_lookups(int) to authenticated;

-- The definitions for a list of codes (missing ones are simply absent; the app infers a system).
create or replace function public.dtc_definitions(p_codes text[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('code', d.code, 'description', d.description, 'system', d.system, 'category', d.category,
                                               'is_generic', d.is_generic, 'common_causes', to_jsonb(d.common_causes), 'safety_flag', d.safety_flag) order by d.code), '[]'::jsonb)
  from public.dtc_codes d where d.code = any (select upper(c) from unnest(coalesce(p_codes, '{}'::text[])) c)
$$;
grant execute on function public.dtc_definitions(text[]) to authenticated;
