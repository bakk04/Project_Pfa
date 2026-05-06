'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image'

const UsersPage = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/dashboardAdmin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (id: string, updates: any) => {
    try {
      const response = await fetch('/api/dashboardAdmin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      if (response.ok) {
        setUsers(users.map(user => user._id === id ? { ...user, ...updates } : user));
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap page-breadcrumb gap-3 mb-6">
        <div className="my-auto">
          <h3 className="text-xl font-bold">User Management</h3>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border-color overflow-hidden">
        <div className="p-4 border-b border-border-color flex items-center justify-between">
          <h6 className="font-semibold">All Users</h6>
          <span className="text-xs text-gray-500">{users.length} Users Found</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-gray-500">No users found.</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="size-10 rounded-full bg-gray-200 me-3 flex items-center justify-center overflow-hidden">
                        {user.profileImage ? (
                          <Image src={user.profileImage} alt="" width={40} height={40} className="size-full object-cover" />
                        ) : (
                          <i className="ph ph-user text-xl text-gray-400"></i>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.role} 
                      onChange={(e) => handleUpdateUser(user._id, { role: e.target.value })}
                      className="bg-transparent border border-border-color rounded px-2 py-1 text-sm focus:ring-primary cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={user.status} 
                      onChange={(e) => handleUpdateUser(user._id, { status: e.target.value })}
                      className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border-none focus:ring-0 cursor-pointer ${user.status === 'active' ? 'bg-success-50 text-success' : 'bg-gray-100 text-gray-500'}`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button className="size-8 rounded-lg border border-border-color flex items-center justify-center text-gray-500 hover:text-primary hover:border-primary">
                        <i className="ph ph-eye"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default UsersPage;
