import { useState } from "react"

import { UsersFilterBar } from "@/modules/users/components/UsersFilterBar"
import { UsersTable } from "@/modules/users/components/UsersTable"
import { UsersPagination } from "@/modules/users/components/UsersPagination"
import { UserModal } from "@/modules/users/components/UserModal"
import { CreateUserModal } from "@/modules/users/components/CreateUserModal"

import { useUsersList } from "@/modules/users/hooks/use-users-list"

import type { UsersListQueryParams } from "@/modules/users/types/users.types"
import { useUiStore } from "@/shared/store/ui.store"
import { useEffect } from "react"

export default function UsersPage() {

  useEffect(() => {

    useUiStore.setState({
      header: {
        mode: "users",
        title: "Пользователи",
        submitDisabled: false,
      }
    })

    return () => {
      useUiStore.getState().resetHeader()
    }

  }, [])

  const [filters, setFilters] =
    useState<UsersListQueryParams>({
      page: 1,
      pageSize: 20,
      searchQuery: "",
      role: "",
    })

  const { data, isFetching } =
    useUsersList(filters)

  const users = data?.items ?? []

  const [selectedUserId, setSelectedUserId] =
  useState<number | null>(null)

  const [isUserModalOpen, setUserModalOpen] =
    useState(false)

  const handleFiltersChange = (
    patch: Partial<UsersListQueryParams>
  ) => {

    setFilters(prev => ({
      ...prev,
      ...patch,
    }))

  }

  const handleReset = () => {

    setFilters({
      page: 1,
      pageSize: 20,
      searchQuery: "",
      role: "",
    })

  }

  const handlePageChange = (
    page: number
  ) => {

    setFilters(prev => ({
      ...prev,
      page,
    }))

  }

  const handleOpenUser = (
    id: number
  ) => {

    setSelectedUserId(id)
    setUserModalOpen(true)

  }

  return (

    <>

      <UsersFilterBar
        filters={filters}
        isFetching={isFetching}

        onFiltersChange={handleFiltersChange}
        onReset={handleReset}
      />

      <div style={{ marginBottom: "24px" }}></div>

      <UsersTable
        users={users}
        onOpenUser={handleOpenUser}
      />

      <UsersPagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        totalCount={data?.totalCount ?? 0}

        isFetching={isFetching}

        onPageChange={handlePageChange}
      />

      <UserModal
        userId={selectedUserId}
        isOpen={isUserModalOpen}
        onClose={() => setUserModalOpen(false)}
      />

      <CreateUserModal />

    </>

  )
}