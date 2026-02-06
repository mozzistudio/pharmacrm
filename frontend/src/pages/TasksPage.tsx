import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { engagementApi } from '../services/api';
import type { Task } from '../types';

export default function TasksPage() {
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await engagementApi.listTasks();
      return data.data as Task[];
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      engagementApi.updateTask(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const priorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return 'badge-red';
      case 'high': return 'badge bg-orange-100 text-orange-800';
      case 'medium': return 'badge-yellow';
      default: return 'badge bg-gray-100 text-gray-800';
    }
  };

  const groupedTasks = {
    pending: tasks?.filter((t) => t.status === 'pending') || [],
    in_progress: tasks?.filter((t) => t.status === 'in_progress') || [],
    completed: tasks?.filter((t) => t.status === 'completed') || [],
    overdue: tasks?.filter((t) => t.status === 'overdue') || [],
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
        <button className="btn-primary">Create Task</button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Loading tasks...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(groupedTasks).map(([status, statusTasks]) => (
            <div key={status}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3 flex items-center gap-2">
                {status.replace(/_/g, ' ')}
                <span className="bg-gray-200 text-gray-600 text-xs rounded-full px-2 py-0.5">
                  {statusTasks.length}
                </span>
              </h3>
              <div className="space-y-3">
                {statusTasks.map((task) => (
                  <div key={task.id} className="card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className={priorityColor(task.priority)}>{task.priority}</span>
                      {task.source === 'ai_recommended' && (
                        <span className="text-xs text-pharma-blue font-medium">AI</span>
                      )}
                    </div>
                    <p className="text-sm font-medium mb-1">{task.title}</p>
                    <p className="text-xs text-gray-500">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                    {task.status !== 'completed' && (
                      <div className="flex gap-1 mt-3">
                        {task.status === 'pending' && (
                          <button
                            onClick={() => updateTask.mutate({ id: task.id, status: 'in_progress' })}
                            className="text-xs text-pharma-blue hover:underline"
                          >
                            Start
                          </button>
                        )}
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => updateTask.mutate({ id: task.id, status: 'completed' })}
                            className="text-xs text-green-600 hover:underline"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
