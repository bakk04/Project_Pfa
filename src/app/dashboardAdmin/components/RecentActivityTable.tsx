'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  profileImage?: string;
  createdAt: string;
}

interface RecentActivityTableProps {
  users: User[];
  loading: boolean;
}

const RecentActivityTable: React.FC<RecentActivityTableProps> = ({ users: initialUsers, loading }) => {
  const [users, setUsers] = useState<User[]>(initialUsers);

  React.useEffect(() => {
    if (initialUsers) setUsers(initialUsers);
  }, [initialUsers]);

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/dashboardAdmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, status: newStatus }),
      });

      if (res.ok) {
        setUsers(users.map(u => u._id === userId ? { ...u, status: newStatus } : u));
        toast.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
      }
    } catch (error) {
      toast.error('Error updating status');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Permanently delete this clinical account?')) return;
    try {
      const res = await fetch(`/api/dashboardAdmin/users?id=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u._id !== userId));
        toast.success('Account purged');
      }
    } catch (error) {
      toast.error('Error deleting user');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(5, 150, 105, 0.1)', borderTop: '4px solid var(--sys-color-primary)', borderRadius: '50%' }} className="animate-spin"></div>
        <p className="sys-text-label">Accessing Clinical Registry...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ 
        padding: '1.5rem', 
        borderBottom: '1px solid var(--sys-border)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        backgroundColor: 'var(--sys-bg-base)'
      }}>
        <div>
          <h6 className="sys-text-h2" style={{ marginBottom: '4px' }}>User Intelligence</h6>
          <p className="sys-text-muted">Biometric access control & audit trail</p>
        </div>
        <button className="medical-btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '10px', color: 'var(--sys-text-h2)', borderColor: 'var(--sys-border)' }}>
          Sync Registry <i className="ph ph-arrows-clockwise"></i>
        </button>
      </div>
      
      <div style={{ overflowX: 'auto', flexGrow: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--sys-bg-subtle)', borderBottom: '1px solid var(--sys-border)' }}>
              <th className="sys-text-label" style={{ padding: '1rem 1.5rem' }}>User / Patient</th>
              <th className="sys-text-label" style={{ padding: '1rem 1.5rem' }}>Role</th>
              <th className="sys-text-label" style={{ padding: '1rem 1.5rem' }}>Status</th>
              <th className="sys-text-label" style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {users?.slice(0, 6).map((user) => (
                <motion.tr 
                  key={user._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  style={{ borderBottom: '1px solid var(--sys-border-subtle)' }}
                  className="sys-transition"
                >
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '12px', 
                        backgroundColor: 'var(--sys-bg-subtle)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--sys-color-primary)',
                        fontWeight: 800,
                        fontSize: '11px',
                        border: '1px solid var(--sys-border)'
                      }}>
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </div>
                      <div>
                        <div className="sys-text-body" style={{ fontWeight: 700, marginBottom: '2px' }}>{user.firstName} {user.lastName}</div>
                        <div className="sys-text-muted" style={{ fontSize: '11px' }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      backgroundColor: 'var(--sys-bg-subtle)', 
                      color: 'var(--sys-text-muted)',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      padding: '4px 10px', 
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      backgroundColor: user.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: user.status === 'active' ? '#10b981' : '#ef4444'
                    }}>
                      <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        backgroundColor: user.status === 'active' ? '#10b981' : '#ef4444'
                      }}></span>
                      {user.status || 'active'}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleStatusChange(user._id, user.status === 'active' ? 'inactive' : 'active')}
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '8px', 
                          border: '1px solid var(--sys-border)',
                          backgroundColor: 'var(--sys-bg-surface)',
                          color: user.status === 'active' ? '#f97316' : '#10b981',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="sys-transition"
                        title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        <i className={`ph ${user.status === 'active' ? 'ph-user-minus' : 'ph-user-plus'}`} style={{ fontSize: '1.125rem' }}></i>
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user._id)}
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '8px', 
                          border: '1px solid var(--sys-border)',
                          backgroundColor: 'var(--sys-bg-surface)',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        className="sys-transition"
                        title="Purge Account"
                      >
                        <i className="ph ph-trash" style={{ fontSize: '1.125rem' }}></i>
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentActivityTable;
