import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { ClearCheckOrder } from "@/lib/clearcheck/types";
import { Loader2, Search, Phone, MessageSquare } from "lucide-react";

export default function ClearCheckDashboard() {
    const [orders, setOrders] = useState<ClearCheckOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('clearcheck_orders')
                .select('*')
                .eq('is_open', true)
                .order('due_rep', { ascending: true, nullsFirst: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.error(err);
            toast({
                title: "Failed to Load Orders",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateECD = async (orderId: string, newECD: string) => {
        try {
            const { error } = await supabase
                .from('clearcheck_orders')
                .update({ current_ecd: newECD })
                .eq('id', orderId);

            if (error) throw error;

            toast({
                title: "ECD Updated",
                description: "Estimated completion date has been saved.",
            });

            // Refresh orders
            fetchOrders();
        } catch (err) {
            console.error(err);
            toast({
                title: "Update Failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        }
    };

    const handleBulkAction = async (action: 'TEXT' | 'CALL', orderIds: string[]) => {
        try {
            const contactAttempts = orderIds.map(orderId => ({
                order_id: orderId,
                method: action,
            }));

            const { error } = await supabase
                .from('clearcheck_contact_attempts')
                .insert(contactAttempts);

            if (error) throw error;

            toast({
                title: "Contact Logged",
                description: `Logged ${action} attempt for ${orderIds.length} order(s).`,
            });
        } catch (err) {
            console.error(err);
            toast({
                title: "Logging Failed",
                description: err instanceof Error ? err.message : "Unknown error",
                variant: "destructive",
            });
        }
    };

    const filteredOrders = orders.filter(order => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            order.job_id?.toLowerCase().includes(query) ||
            order.client_primary?.toLowerCase().includes(query) ||
            order.rep_display_name?.toLowerCase().includes(query) ||
            order.city?.toLowerCase().includes(query)
        );
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">ClearCheck Dashboard</h1>
                    <p className="text-muted-foreground">Manage order chasers and updates.</p>
                </div>
                <Button onClick={fetchOrders} variant="outline" size="sm">
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Order Search</CardTitle>
                    <CardDescription>Filter orders by Job ID, Client, Rep, or City</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search orders..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Open Orders ({filteredOrders.length})</span>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkAction('TEXT', filteredOrders.slice(0, 5).map(o => o.id))}
                                disabled={filteredOrders.length === 0}
                            >
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Text (Top 5)
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkAction('CALL', filteredOrders.slice(0, 5).map(o => o.id))}
                                disabled={filteredOrders.length === 0}
                            >
                                <Phone className="mr-2 h-4 w-4" />
                                Call (Top 5)
                            </Button>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Sts</TableHead>
                                    <TableHead>Job ID</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead>Address</TableHead>
                                    <TableHead>City</TableHead>
                                    <TableHead>State</TableHead>
                                    <TableHead>Rep</TableHead>
                                    <TableHead>Due</TableHead>
                                    <TableHead>Rep Due</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>ECD</TableHead>
                                    <TableHead>Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredOrders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={12} className="text-center text-muted-foreground">
                                            No orders found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredOrders.map(order => (
                                        <TableRow key={order.id}>
                                            <TableCell>
                                                <Badge variant={order.is_open ? "default" : "secondary"}>
                                                    {order.status || 'N/A'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{order.job_id}</TableCell>
                                            <TableCell>{order.service || '-'}</TableCell>
                                            <TableCell>{order.street || '-'}</TableCell>
                                            <TableCell>{order.city || '-'}</TableCell>
                                            <TableCell>{order.state || '-'}</TableCell>
                                            <TableCell>{order.rep_display_name || '-'}</TableCell>
                                            <TableCell>{order.due_client || '-'}</TableCell>
                                            <TableCell>{order.due_rep || '-'}</TableCell>
                                            <TableCell>{order.client_primary || '-'}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="date"
                                                    value={order.current_ecd || ''}
                                                    onChange={(e) => handleUpdateECD(order.id, e.target.value)}
                                                    className="w-36"
                                                />
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {order.current_delay_reason_label || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
