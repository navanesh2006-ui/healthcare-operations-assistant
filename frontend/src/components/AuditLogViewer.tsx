import React, { useState, useEffect } from 'react';
import { auditApi } from '../services/api';
import { AuditLog } from '../types';
import { ShieldCheck, Clock, User, Activity, FileText } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditApi.list().then(res => {
      setLogs(res);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-forestGreen">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-limeAccent" />
          Responsible AI Audit Trail & Governance Logs
        </h1>
        <p className="text-xs text-textLight/70">
          Full audit record (who/what/when) tracking all agent actions, reviewer queue edits, and Second Brain writes
        </p>
      </div>

      <div className="bg-panelBg border border-forestGreen rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-forestGreen/60 text-limeAccent uppercase font-mono border-b border-forestGreen">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">User Role</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Entity</th>
                <th className="p-3.5">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forestGreen/40 text-textLight">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-forestGreen/20 transition">
                  <td className="p-3.5 whitespace-nowrap text-textLight/60 font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3.5">
                    <span className="bg-darkBg text-limeAccent border border-forestGreen px-2 py-0.5 rounded uppercase font-bold text-[10px]">
                      {log.user_role}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-white">{log.action}</td>
                  <td className="p-3.5 text-textLight/80">{log.entity_type} #{log.entity_id}</td>
                  <td className="p-3.5 text-textLight/90 max-w-md truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
