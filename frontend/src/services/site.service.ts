import { api as axios } from "@/lib/axios";
import { Site, SiteListItem } from "@/types";

export const siteService = {
  // Get user's accessible sites
  async getUserSites(): Promise<SiteListItem[]> {
    const response = await axios.get('v1/site/sites/user_sites/');
    return response.data;
  },

  // Get all sites (admin only)
  async getAllSites(): Promise<Site[]> {
    const response = await axios.get('v1/site/sites/');
    return response.data;
  },

  // Get specific site details
  async getSite(id: number): Promise<Site> {
    const response = await axios.get(`v1/site/sites/${id}/`);
    return response.data;
  },

  // Create new site (admin only)
  async createSite(siteData: Omit<Site, 'id' | 'created_at' | 'updated_at'>): Promise<Site> {
    const response = await axios.post('v1/site/sites/', siteData);
    return response.data;
  },

  // Update site (admin only)
  async updateSite(id: number, siteData: Partial<Site>): Promise<Site> {
    const response = await axios.patch(`v1/site/sites/${id}/`, siteData);
    return response.data;
  },

  // Delete site (admin only)
  async deleteSite(id: number): Promise<void> {
    await axios.delete(`v1/site/sites/${id}/`);
  },

  // Grant user access to site (admin only)
  async grantUserAccess(siteId: number, userId: number): Promise<void> {
    await axios.post(`v1/site/sites/${siteId}/grant_access/`, { user_id: userId });
  },

  // Revoke user access to site (admin only)
  async revokeUserAccess(siteId: number, userId: number): Promise<void> {
    await axios.delete(`v1/site/sites/${siteId}/revoke_access/`, { data: { user_id: userId } });
  }
};